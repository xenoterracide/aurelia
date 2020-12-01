import { DI } from '@aurelia/kernel';
import type { IIndexable, IServiceLocator } from '@aurelia/kernel';
import type { Scope } from './observation/binding-context.js';

import type { CollectionLengthObserver } from './observation/collection-length-observer.js';
import type { CollectionSizeObserver } from './observation/collection-size-observer.js';

export interface IBinding {
  interceptor: this;
  readonly locator: IServiceLocator;
  readonly $scope?: Scope;
  readonly $hostScope: Scope | null;
  readonly isBound: boolean;
  $bind(flags: LifecycleFlags, scope: Scope, hostScope: Scope | null): void;
  $unbind(flags: LifecycleFlags): void;
}

export type InterceptorFunc<TInput = unknown, TOutput = unknown> = (value: TInput) => TOutput;

export interface ILifecycle extends Lifecycle {}
export const ILifecycle = DI.createInterface<ILifecycle>('ILifecycle', x => x.singleton(Lifecycle));

export class Lifecycle  {
  public readonly batch: IAutoProcessingQueue<IBatchable> = new BatchQueue(this);
}

export interface IProcessingQueue<T> {
  add(requestor: T): void;
  process(flags: LifecycleFlags): void;
}

export interface IAutoProcessingQueue<T> extends IProcessingQueue<T> {
  readonly depth: number;
  begin(): void;
  end(flags?: LifecycleFlags): void;
  inline(fn: () => void, flags?: LifecycleFlags): void;
}

export class BatchQueue implements IAutoProcessingQueue<IBatchable> {
  public queue: IBatchable[] = [];
  public depth: number = 0;

  public constructor(
    @ILifecycle public readonly lifecycle: ILifecycle,
  ) {}

  public begin(): void {
    ++this.depth;
  }

  public end(flags?: LifecycleFlags): void {
    if (flags === void 0) {
      flags = LifecycleFlags.none;
    }
    if (--this.depth === 0) {
      this.process(flags);
    }
  }

  public inline(fn: () => void, flags?: LifecycleFlags): void {
    this.begin();
    fn();
    this.end(flags);
  }

  public add(requestor: IBatchable): void {
    this.queue.push(requestor);
  }

  public remove(requestor: IBatchable): void {
    const index = this.queue.indexOf(requestor);
    if (index > -1) {
      this.queue.splice(index, 1);
    }
  }

  public process(flags: LifecycleFlags): void {
    while (this.queue.length > 0) {
      const batch = this.queue.slice();
      this.queue = [];
      const { length } = batch;
      for (let i = 0; i < length; ++i) {
        batch[i].flushBatch(flags);
      }
    }
  }
}

/*
* Note: the oneTime binding now has a non-zero value for 2 reasons:
*  - plays nicer with bitwise operations (more consistent code, more explicit settings)
*  - allows for potentially having something like BindingMode.oneTime | BindingMode.fromView, where an initial value is set once to the view but updates from the view also propagate back to the view model
*
* Furthermore, the "default" mode would be for simple ".bind" expressions to make it explicit for our logic that the default is being used.
* This essentially adds extra information which binding could use to do smarter things and allows bindingBehaviors that add a mode instead of simply overwriting it
*/
export enum BindingMode {
  oneTime  = 0b0001,
  toView   = 0b0010,
  fromView = 0b0100,
  twoWay   = 0b0110,
  default  = 0b1000
}

export const enum LifecycleFlags {
  none                          = 0b0000_000_00_00_000,
  // Bitmask for flags that need to be stored on a binding during $bind for mutation
  // callbacks outside of $bind
  persistentBindingFlags        = 0b1111_000_00_00_111,
  allowParentScopeTraversal     = 0b0001_000_00_00_000,
  observeLeafPropertiesOnly     = 0b0010_000_00_00_000,
  targetObserverFlags           = 0b1100_000_00_00_111,
  noFlush                       = 0b0100_000_00_00_000,
  persistentTargetObserverQueue = 0b1000_000_00_00_000,
  bindingStrategy               = 0b0000_000_00_00_111,
  getterSetterStrategy          = 0b0000_000_00_00_001,
  proxyStrategy                 = 0b0000_000_00_00_010,
  isStrictBindingStrategy       = 0b0000_000_00_00_100,
  update                        = 0b0000_000_00_11_000,
  updateTarget                  = 0b0000_000_00_01_000,
  updateSource                  = 0b0000_000_00_10_000,
  from                          = 0b0000_000_11_00_000,
  fromBind                      = 0b0000_000_01_00_000,
  fromUnbind                    = 0b0000_000_10_00_000,
  mustEvaluate                  = 0b0000_001_00_00_000,
  isTraversingParentScope       = 0b0000_010_00_00_000,
  dispose                       = 0b0000_100_00_00_000,
}

export interface IConnectable {
  observeProperty(obj: object, propertyName: string): void;
}

/** @internal */
export const enum SubscriberFlags {
  None            = 0,
  Subscriber0     = 0b0001,
  Subscriber1     = 0b0010,
  Subscriber2     = 0b0100,
  SubscribersRest = 0b1000,
  Any             = 0b1111,
}

export enum DelegationStrategy {
  none = 0,
  capturing = 1,
  bubbling = 2
}

export interface IBatchable {
  flushBatch(flags: LifecycleFlags): void;
}

export interface ISubscriber<TValue = unknown> {
  id?: number;
  handleChange(newValue: TValue, previousValue: TValue, flags: LifecycleFlags): void;
}

export interface ICollectionSubscriber {
  handleCollectionChange(indexMap: IndexMap, flags: LifecycleFlags): void;
}

export interface ISubscribable {
  subscribe(subscriber: ISubscriber): void;
  unsubscribe(subscriber: ISubscriber): void;
}

export interface ICollectionSubscribable {
  subscribeToCollection(subscriber: ICollectionSubscriber): void;
  unsubscribeFromCollection(subscriber: ICollectionSubscriber): void;
}

export interface ISubscriberCollection extends ISubscribable {
  [key: number]: LifecycleFlags;

  /** @internal */_subscriberFlags: SubscriberFlags;
  /** @internal */_subscriber0?: ISubscriber;
  /** @internal */_subscriber1?: ISubscriber;
  /** @internal */_subscriber2?: ISubscriber;
  /** @internal */_subscribersRest?: ISubscriber[];

  callSubscribers(newValue: unknown, oldValue: unknown, flags: LifecycleFlags): void;
  hasSubscribers(): boolean;
  hasSubscriber(subscriber: ISubscriber): boolean;
  removeSubscriber(subscriber: ISubscriber): boolean;
  addSubscriber(subscriber: ISubscriber): boolean;
}

export interface ICollectionSubscriberCollection extends ICollectionSubscribable {
  [key: number]: LifecycleFlags;

  /** @internal */_collectionSubscriberFlags: SubscriberFlags;
  /** @internal */_collectionSubscriber0?: ICollectionSubscriber;
  /** @internal */_collectionSubscriber1?: ICollectionSubscriber;
  /** @internal */_collectionSubscriber2?: ICollectionSubscriber;
  /** @internal */_collectionSubscribersRest?: ICollectionSubscriber[];

  callCollectionSubscribers(indexMap: IndexMap, flags: LifecycleFlags): void;
  hasCollectionSubscribers(): boolean;
  hasCollectionSubscriber(subscriber: ICollectionSubscriber): boolean;
  removeCollectionSubscriber(subscriber: ICollectionSubscriber): boolean;
  addCollectionSubscriber(subscriber: ICollectionSubscriber): boolean;
}

/**
 * Describes a complete property observer with an accessor, change tracking fields, normal and batched subscribers
 */
export interface IPropertyObserver<TObj extends object, TProp extends keyof TObj> extends
  IAccessor<TObj[TProp]>,
  IPropertyChangeTracker<TObj, TProp>,
  ISubscriberCollection,
  IBatchable {
  inBatch: boolean;
  observing: boolean;
}

/**
 * An any-typed property observer
 */
export type PropertyObserver = IPropertyObserver<IIndexable, string>;

/**
 * A collection (array, set or map)
 */
export type Collection = unknown[] | Set<unknown> | Map<unknown, unknown>;

export const enum CollectionKind {
  indexed = 0b1000,
  keyed   = 0b0100,
  array   = 0b1001,
  map     = 0b0110,
  set     = 0b0111
}

export type LengthPropertyName<T> =
  T extends unknown[] ? 'length' :
    T extends Set<unknown> ? 'size' :
      T extends Map<unknown, unknown> ? 'size' :
        never;

export type CollectionTypeToKind<T> =
  T extends unknown[] ? CollectionKind.array | CollectionKind.indexed :
    T extends Set<unknown> ? CollectionKind.set | CollectionKind.keyed :
      T extends Map<unknown, unknown> ? CollectionKind.map | CollectionKind.keyed :
        never;

export type CollectionKindToType<T> =
  T extends CollectionKind.array ? unknown[] :
    T extends CollectionKind.indexed ? unknown[] :
      T extends CollectionKind.map ? Map<unknown, unknown> :
        T extends CollectionKind.set ? Set<unknown> :
          T extends CollectionKind.keyed ? Set<unknown> | Map<unknown, unknown> :
            never;

export type ObservedCollectionKindToType<T> =
  T extends CollectionKind.array ? unknown[] :
    T extends CollectionKind.indexed ? unknown[] :
      T extends CollectionKind.map ? Map<unknown, unknown> :
        T extends CollectionKind.set ? Set<unknown> :
          T extends CollectionKind.keyed ? Map<unknown, unknown> | Set<unknown> :
            never;

export const enum AccessorType {
  None          = 0b0_0000_0000,
  Observer      = 0b0_0000_0001,

  Node          = 0b0_0000_0010,
  Obj           = 0b0_0000_0100,

  Array         = 0b0_0000_1010,
  Set           = 0b0_0001_0010,
  Map           = 0b0_0010_0010,

  // misc characteristic of accessors/observers when update
  //
  // by default, everything is synchronous
  // except changes that are supposed to cause reflow/heavy computation
  // an observer can use this flag to signal binding that don't carelessly tell it to update
  // queue it instead
  // todo: https://gist.github.com/paulirish/5d52fb081b3570c81e3a
  // todo: https://csstriggers.com/
  Layout        = 0b0_0100_0000,

  // there needs to be a flag to signal that accessor real value
  // may get out of sync with binding value
  // so that binding can ask for a force read instead of cache read
}

/**
 * Basic interface to normalize getting/setting a value of any property on any object
 */
export interface IAccessor<TValue = unknown> {
  type: AccessorType;
  getValue(obj?: object, key?: PropertyKey): TValue;
  setValue(newValue: TValue, flags: LifecycleFlags, obj?: object, key?: PropertyKey): void;
}

export interface IObserver extends IAccessor, ISubscribable {}

/**
 * Describes a target observer for to-view bindings (in other words, an observer without the observation).
 */
export interface IBindingTargetAccessor<
  TObj = any,
  TProp = keyof TObj,
  TValue = unknown>
  extends IAccessor<TValue>,
  IPropertyChangeTracker<TObj, TProp> {
  bind?(flags: LifecycleFlags): void;
  unbind?(flags: LifecycleFlags): void;
}

/**
 * Describes a target observer for from-view or two-way bindings.
 */
export interface IBindingTargetObserver<
  TObj = any,
  TProp = keyof TObj,
  TValue = unknown>
  extends IBindingTargetAccessor<TObj, TProp, TValue>,
  ISubscribable,
  ISubscriberCollection {}

export type AccessorOrObserver = (IBindingTargetAccessor | IBindingTargetObserver) & {
  doNotCache?: boolean;
};

/**
 * An array of indices, where the index of an element represents the index to map FROM, and the numeric value of the element itself represents the index to map TO
 *
 * The deletedItems property contains the items (in case of an array) or keys (in case of map or set) that have been deleted.
 */
export type IndexMap = number[] & {
  deletedItems: number[];
  isIndexMap: true;
};

export function copyIndexMap(
  existing: number[] & { deletedItems?: number[] },
  deletedItems?: number[],
): IndexMap {
  const { length } = existing;
  const arr = Array(length) as IndexMap;
  let i = 0;
  while (i < length) {
    arr[i] = existing[i];
    ++i;
  }
  if (deletedItems !== void 0) {
    arr.deletedItems = deletedItems.slice(0);
  } else if (existing.deletedItems !== void 0) {
    arr.deletedItems = existing.deletedItems.slice(0);
  } else {
    arr.deletedItems = [];
  }
  arr.isIndexMap = true;
  return arr;
}

export function createIndexMap(length: number = 0): IndexMap {
  const arr = Array(length) as IndexMap;
  let i = 0;
  while (i < length) {
    arr[i] = i++;
  }
  arr.deletedItems = [];
  arr.isIndexMap = true;
  return arr;
}

export function cloneIndexMap(indexMap: IndexMap): IndexMap {
  const clone = indexMap.slice() as IndexMap;
  clone.deletedItems = indexMap.deletedItems.slice();
  clone.isIndexMap = true;
  return clone;
}

export function isIndexMap(value: unknown): value is IndexMap {
  return value instanceof Array && (value as IndexMap).isIndexMap === true;
}

/**
 * Describes a type that specifically tracks changes in an object property, or simply something that can have a getter and/or setter
 */
export interface IPropertyChangeTracker<TObj, TProp = keyof TObj, TValue = unknown> {
  obj: TObj;
  propertyKey?: TProp;
  currentValue?: TValue;
}

export interface ICollectionIndexObserver extends ICollectionSubscriber, IPropertyObserver<IIndexable, string> {
  owner: ICollectionObserver<CollectionKind.array>;
}

/**
 * Describes a type that specifically tracks changes in a collection (map, set or array)
 */
export interface ICollectionChangeTracker<T extends Collection> {
  collection: T;
  indexMap: IndexMap;
}

/**
 * An observer that tracks collection mutations and notifies subscribers (either directly or in batches)
 */
export interface ICollectionObserver<T extends CollectionKind> extends
  ICollectionChangeTracker<CollectionKindToType<T>>,
  ICollectionSubscriberCollection,
  IBatchable {
  type: AccessorType;
  inBatch: boolean;
  lifecycle?: ILifecycle;
  collection: ObservedCollectionKindToType<T>;
  lengthObserver: T extends CollectionKind.array ? CollectionLengthObserver : CollectionSizeObserver;
  getLengthObserver(): T extends CollectionKind.array ? CollectionLengthObserver : CollectionSizeObserver;
  getIndexObserver(index: number): ICollectionIndexObserver;
  notify(): void;
}
export type CollectionObserver = ICollectionObserver<CollectionKind>;

export interface IBindingContext {
  [key: string]: any;
}

export interface IOverrideContext {
  [key: string]: unknown;

  readonly bindingContext: IBindingContext;
}

export type IObservable<T = IIndexable> = T & {
  $observers?: IIndexable<{}, AccessorOrObserver>;
};
