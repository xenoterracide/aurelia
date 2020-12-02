import { DI, IContainer, Registration, InstanceProvider, IDisposable, onResolve } from '@aurelia/kernel';
import { BrowserPlatform } from '@aurelia/platform-browser';
import { AppRoot, IAppRoot, ISinglePageApp } from './app-root.js';
import { IPlatform } from './platform.js';

export interface IAurelia extends Aurelia {}
export const IAurelia = DI.createInterface<IAurelia>('IAurelia');

export class Aurelia implements IDisposable {
  private _isRunning: boolean = false;
  public get isRunning(): boolean { return this._isRunning; }
  private _isStarting: boolean = false;
  public get isStarting(): boolean { return this._isStarting; }
  private _isStopping: boolean = false;
  public get isStopping(): boolean { return this._isStopping; }

  private _root: IAppRoot | undefined = void 0;
  public get root(): IAppRoot {
    if (this._root == void 0) {
      if (this.next == void 0) {
        throw new Error(`root is not defined`); // TODO: create error code
      }
      return this.next;
    }
    return this._root;
  }

  private next: IAppRoot | undefined = void 0;

  private readonly rootProvider: InstanceProvider<IAppRoot>;

  public constructor(
    public readonly container: IContainer = DI.createContainer(),
  ) {
    if (container.has(IAurelia, true)) {
      throw new Error('An instance of Aurelia is already registered with the container or an ancestor of it.');
    }

    container.register(Registration.instance(IAurelia, this));
    container.registerResolver(IAppRoot, this.rootProvider = new InstanceProvider('IAppRoot'));
  }

  public register(...params: any[]): this {
    this.container.register(...params);
    return this;
  }

  public app(config: ISinglePageApp): Omit<this, 'register' | 'app' | 'enhance'> {
    this.next = new AppRoot(config, this.initPlatform(config.host), this.container, this.rootProvider, false);
    return this;
  }

  public enhance(config: ISinglePageApp): Omit<this, 'register' | 'app' | 'enhance'> {
    this.next = new AppRoot(config, this.initPlatform(config.host), this.container, this.rootProvider, true);
    return this;
  }

  private initPlatform(host: HTMLElement): IPlatform {
    let p: IPlatform;
    if (!this.container.has(IPlatform, false)) {
      if (host.ownerDocument.defaultView === null) {
        throw new Error(`Failed to initialize the platform object. The host element's ownerDocument does not have a defaultView`);
      }
      p = new BrowserPlatform(host.ownerDocument.defaultView);
      this.container.register(Registration.instance(IPlatform, p));
    } else {
      p = this.container.get(IPlatform);
    }
    return p;
  }

  private startPromise: Promise<void> | void = void 0;
  public start(root: IAppRoot | undefined = this.next): void | Promise<void> {
    if (root == void 0) {
      throw new Error(`There is no composition root`);
    }

    if (this.startPromise instanceof Promise) {
      return this.startPromise;
    }

    return this.startPromise = onResolve(this.stop(), () => {
      Reflect.set(root.host, '$aurelia', this);
      this.rootProvider.prepare(this._root = root);
      this._isStarting = true;

      return onResolve(root.activate(), () => {
        this._isRunning = true;
        this._isStarting = false;
        this.startPromise = void 0;
        this.dispatchEvent(root, 'au-started', root.host);
      });
    });
  }

  private stopPromise: Promise<void> | void = void 0;
  public stop(dispose: boolean = false): void | Promise<void> {
    if (this.stopPromise instanceof Promise) {
      return this.stopPromise;
    }

    if (this._isRunning === true) {
      const root = this._root!;
      this._isRunning = false;
      this._isStopping = true;

      return this.stopPromise = onResolve(root.deactivate(), () => {
        Reflect.deleteProperty(root.host, '$aurelia');
        if (dispose) {
          root.dispose();
        }
        this._root = void 0;
        this.rootProvider.dispose();
        this._isStopping = false;
        this.dispatchEvent(root, 'au-stopped', root.host);
      });
    }
  }

  public dispose(): void {
    if (this._isRunning || this._isStopping) {
      throw new Error(`The aurelia instance must be fully stopped before it can be disposed`);
    }
    this.container.dispose();
  }

  private dispatchEvent(root: IAppRoot, name: string, target: HTMLElement): void {
    const ev = new root.platform.window.CustomEvent(name, { detail: this, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
  }
}
