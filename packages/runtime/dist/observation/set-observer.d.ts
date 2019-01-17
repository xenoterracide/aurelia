import { ILifecycle } from '../lifecycle';
import { CollectionKind, ICollectionObserver, IObservedSet, LifecycleFlags } from '../observation';
export declare function enableSetObservation(): void;
export declare function disableSetObservation(): void;
export interface SetObserver extends ICollectionObserver<CollectionKind.set> {
}
export declare class SetObserver implements SetObserver {
    resetIndexMap: () => void;
    collection: IObservedSet;
    readonly flags: LifecycleFlags;
    constructor(flags: LifecycleFlags, lifecycle: ILifecycle, observedSet: IObservedSet);
}
export declare function getSetObserver(flags: LifecycleFlags, lifecycle: ILifecycle, observedSet: IObservedSet): SetObserver;
//# sourceMappingURL=set-observer.d.ts.map