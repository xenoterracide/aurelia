import { DI } from '@aurelia/kernel';
import { LifecycleFlags } from '../observation.js';
import type { ISubscriber } from '../observation.js';

type Signal = string;

export interface ISignaler extends Signaler {}
export const ISignaler = DI.createInterface<ISignaler>('ISignaler', x => x.singleton(Signaler));

export class Signaler {
  public signals: Record<string, Set<ISubscriber>> = Object.create(null);

  public dispatchSignal(name: Signal, flags?: LifecycleFlags): void {
    const listeners = this.signals[name];
    if (listeners === undefined) {
      return;
    }
    for (const listener of listeners.keys()) {
      listener.handleChange(undefined, undefined, flags! | LifecycleFlags.updateTarget);
    }
  }

  public addSignalListener(name: Signal, listener: ISubscriber): void {
    const signals = this.signals;
    const listeners = signals[name];
    if (listeners === undefined) {
      signals[name] = new Set([listener]);
    } else {
      listeners.add(listener);
    }
  }

  public removeSignalListener(name: Signal, listener: ISubscriber): void {
    const listeners = this.signals[name];
    if (listeners) {
      listeners.delete(listener);
    }
  }
}
