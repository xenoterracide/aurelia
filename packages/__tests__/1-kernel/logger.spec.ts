import { Done } from 'mocha';
import { ColorOptions, DI, IConsoleLike, IContainer, ILogger, LoggerConfiguration, LogLevel } from '@aurelia/kernel';
import { assert, eachCartesianJoin } from '@aurelia/testing';

class ConsoleMock implements IConsoleLike {
  public readonly calls: [keyof ConsoleMock, unknown[]][] = [];

  public debug(...args: unknown[]): void {
    this.calls.push(['debug', args]);
    console.debug(...args);
  }

  public info(...args: unknown[]): void {
    this.calls.push(['info', args]);
    console.info(...args);
  }

  public warn(...args: unknown[]): void {
    this.calls.push(['warn', args]);
    console.warn(...args);
  }

  public error(...args: unknown[]): void {
    this.calls.push(['error', args]);
    console.error(...args);
  }
}

const levels: [LogLevel, string, string, string][] = [
  [
    LogLevel.trace,
    'trace',
    'debug',
    'TRC',
  ],
  [
    LogLevel.debug,
    'debug',
    'debug',
    'DBG',
  ],
  [
    LogLevel.info,
    'info',
    'info',
    'INF',
  ],
  [
    LogLevel.warn,
    'warn',
    'warn',
    'WRN',
  ],
  [
    LogLevel.error,
    'error',
    'error',
    'ERR',
  ],
  [
    LogLevel.fatal,
    'fatal',
    'error',
    'FTL',
  ],
  [
    LogLevel.none,
    'none',
    '',
    '',
  ],
];

describe('Logger', function () {
  function createFixture<M extends IConsoleLike & {calls: [keyof ConsoleMock, unknown[]][]}>(
    mock: M, level: LogLevel, colorOpts: ColorOptions, scopeTo: string[]
  ): {sut: ILogger; mock: M; container: IContainer} {

    const container = DI.createContainer();
    container.register(LoggerConfiguration.create(mock, level, colorOpts));

    let sut = container.get(ILogger);
    for (let i = 0; i < scopeTo.length; ++i) {
      sut = sut.scopeTo(scopeTo[i]);
    }

    return { sut, mock, container };
  }

  eachCartesianJoin(
    [
      levels.slice(0, -1),
      levels.slice(),
      [
        ColorOptions.noColors,
        ColorOptions.colors,
      ],
      [
        [
          'test',
        ],
        [
          () => 'test',
        ],
        [
          'test',
          {},
        ],
        [
          () => 'test',
          {},
        ],
      ],
      [
        [],
        ['foo'],
        ['foo', 'bar'],
      ]
    ],
    function (
      [methodLevel, loggerMethodName, consoleMethodName, abbrev],
      [configLevel, configName],
      colorOpts,
      [msgOrGetMsg, ...optionalParams],
      scopeTo,
    ) {
      const colorRE = colorOpts === ColorOptions.colors ? '\\u001b\\[\\d{1,2}m' : '';
      const timestampRE = `${colorRE}\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z${colorRE}`;

      const scopeRE = scopeTo.length === 0
        ? ''
        : ` ${scopeTo.map(x => `${colorRE}${x}${colorRE}`).join('\\.')}`;
      const abbrevRE = `\\[${colorRE}${abbrev}${colorRE}${scopeRE}\\]`;

      describe(`with configured level=${configName}, colors=${colorOpts}, msgOrGetMsg=${msgOrGetMsg}, optionalParams=${optionalParams}, scopeTo=${scopeTo}`, function () {
        if (methodLevel >= configLevel) {
          it(`logs ${loggerMethodName}`, function () {
            const { sut, mock } = createFixture(new ConsoleMock(), configLevel, colorOpts, scopeTo);

            sut[loggerMethodName](msgOrGetMsg, ...optionalParams);

            assert.strictEqual(mock.calls.length, 1, `mock.calls.length`);

            const [method, args] = mock.calls[0];
            assert.strictEqual(method, consoleMethodName, `method`);
            assert.strictEqual(args.length, optionalParams.length + 1, `args.length`);
            assert.match(args[0], new RegExp(`${timestampRE} ${abbrevRE} test`));
            if (optionalParams.length > 0) {
              assert.deepStrictEqual(args.slice(1), optionalParams);
            }
          });
        } else {
          it(`does NOT log ${loggerMethodName}`, function () {
            const { sut, mock } = createFixture(new ConsoleMock(), configLevel, colorOpts, scopeTo);

            sut[loggerMethodName](msgOrGetMsg, ...optionalParams);

            assert.strictEqual(mock.calls.length, 0, `mock.calls.length`);
          });

          it(`can change the level after instantiation`, function () {
            const { sut, mock } = createFixture(new ConsoleMock(), configLevel, colorOpts, scopeTo);

            sut.config.level = methodLevel;

            sut[loggerMethodName](msgOrGetMsg, ...optionalParams);

            assert.strictEqual(mock.calls.length, 1, `mock.calls.length`);

            const [method, args] = mock.calls[0];
            assert.strictEqual(method, consoleMethodName, `method`);
            assert.strictEqual(args.length, optionalParams.length + 1, `args.length`);
            assert.match(args[0], new RegExp(`${timestampRE} ${abbrevRE} test`));
            if (optionalParams.length > 0) {
              assert.deepStrictEqual(args.slice(1), optionalParams);
            }
          });
        }
      });
    }
  );

  describe('Promise', function () {

    class AsyncConsoleMock implements IConsoleLike {

      public constructor(
        private readonly level: [LogLevel, string, string, string],
        private readonly args: unknown[],
        private readonly done: Done) {
      }
      public readonly calls: [keyof ConsoleMock, unknown[]][] = [];

      private tester(method: string, message: string, ...args: unknown[]): void {
        const timestampRE = `\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z`;

        assert.strictEqual(method, this.level[2], `method`);
        assert.match(message, new RegExp(`${timestampRE} \\[${this.level[3]}\\] test`));
        assert.deepStrictEqual(args, this.args);
        this.done();
      }

      public debug(message: string, ...optionalParams: unknown[]): void {
        this.tester('debug', message, optionalParams);
      }
      public info(message: string, ...optionalParams: unknown[]): void {
        this.tester('info', message, optionalParams);
      }
      public warn(message: string, ...optionalParams: unknown[]): void {
        this.tester('debug', message, optionalParams);
      }
      public error(message: string, ...optionalParams: unknown[]): void {
        this.tester('error', message, optionalParams);
      }

    }

    for (const level of levels) {
      if (level[0] === LogLevel.none) continue;
      describe('resolve', function () {
        // eslint-disable-next-line mocha/handle-done-callback
        it(`level=${level[1]} no params`, function (done: Done) {
          const {sut} = createFixture(new AsyncConsoleMock(level, [], done), level[0], ColorOptions.noColors, []);
          sut[level[1]](async () => Promise.resolve('test'));
        });

        // eslint-disable-next-line mocha/handle-done-callback
        it(`level=${level[1]} params`, function (done: Done) {
          const {sut} = createFixture(new AsyncConsoleMock(level, ['a'], done), level[0], ColorOptions.noColors, []);
          sut[level[1]](async () => Promise.resolve('test'), 'a');
        });
      });

      describe('reject', function () {
        // eslint-disable-next-line mocha/handle-done-callback
        it(`level=${level[1]} no params`, function (done: Done) {
          const {sut} = createFixture(new AsyncConsoleMock(level, ['a'], done), level[0], ColorOptions.noColors, []);
          sut[level[1]](async () => Promise.reject(new Error('my error')));
        });

        // eslint-disable-next-line mocha/handle-done-callback
        it(`level=${level[1]} no params`, function (done: Done) {
          const {sut} = createFixture(new AsyncConsoleMock(level, ['a'], done), level[0], ColorOptions.noColors, []);
          sut[level[1]](async () => Promise.reject('test'));
        });
      });
    }
  });
});
