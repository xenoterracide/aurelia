import { IContainer } from '@aurelia/kernel';
import { ICustomElementType, IRenderContext } from '@aurelia/runtime';
import { Router } from './router';
import { IFindViewportsResult } from './scope';
import { IViewportOptions, Viewport } from './viewport';
import { ViewportInstruction } from './viewport-instruction';

export interface IViewportCustomElementType extends ICustomElementType {
  viewport?: string;
}

export interface IFindViewportsResult {
  viewportInstructions?: ViewportInstruction[];
  viewportsRemaining?: boolean;
}

export type ChildContainer = IContainer & { parent?: ChildContainer };

export class Scope {
  public element: Element;
  public context: IRenderContext;
  public parent: Scope;

  public viewport: Viewport;

  public children: Scope[];
  public viewports: Viewport[];

  private readonly router: Router;

  private scopeViewportParts: Record<string, ViewportInstruction[][]>;
  private availableViewports: Record<string, Viewport>;

  constructor(router: Router, element: Element, context: IRenderContext, parent: Scope) {
    this.router = router;
    this.element = element;
    this.context = context;
    this.parent = parent;

    this.viewport = null;
    this.children = [];
    this.viewports = [];
    this.scopeViewportParts = {};
    this.availableViewports = null;

    if (this.parent) {
      this.parent.addChild(this);
    }
  }

  public getEnabledViewports(): Record<string, Viewport> {
    return this.viewports.filter((viewport) => viewport.enabled).reduce(
      (viewports, viewport) => {
        viewports[viewport.name] = viewport;
        return viewports;
      },
      {});
  }

  // TODO: Reduce complexity (currently at 45)
  public findViewports(viewports?: Record<string, string | Viewport>): IFindViewportsResult {
    const instructions: ViewportInstruction[] = [];
    let viewportsRemaining: boolean = false;

    // Get a shallow copy of all available viewports (clean if it's the first find)
    if (viewports) {
      this.availableViewports = {};
      this.scopeViewportParts = {};
    }
    this.availableViewports = { ...this.getEnabledViewports(), ...this.availableViewports };

    // Get the parts for this scope (pointing to the rest)
    for (const viewport in viewports) {
      const parts = this.router.instructionResolver.parseScopedViewportInstruction(viewport);
      const vp = this.router.instructionResolver.stringifyViewportInstruction(parts.shift());
      if (!this.scopeViewportParts[vp]) {
        this.scopeViewportParts[vp] = [];
      }
      this.scopeViewportParts[vp].push(parts);
    }

    // Configured viewport is ruling
    for (const viewportPart in this.scopeViewportParts) {
      const instruction = this.router.instructionResolver.parseViewportInstruction(viewportPart);
      for (const name in this.availableViewports) {
        const viewport: Viewport = this.availableViewports[name];
        // TODO: Also check if (resolved) component wants a specific viewport
        if (viewport && viewport.wantComponent(instruction.componentName)) {
          const found = this.foundViewport(viewports, this.scopeViewportParts, instruction, viewport);
          instructions.push(...found.viewportInstructions);
          viewportsRemaining = viewportsRemaining || found.viewportsRemaining;
          this.availableViewports[name] = null;
          Reflect.deleteProperty(this.scopeViewportParts, viewportPart);
          break;
        }
      }
    }

    // Next in line is specified viewport
    for (const viewportPart in this.scopeViewportParts) {
      const instruction = this.router.instructionResolver.parseViewportInstruction(viewportPart);
      const name = instruction.viewportName;
      if (!name || !name.length || name.startsWith('?')) {
        continue;
      }
      const newScope = instruction.scope;
      if (!this.getEnabledViewports()[name]) {
        this.addViewport(name, null, null, { scope: newScope, forceDescription: true });
        this.availableViewports[name] = this.getEnabledViewports()[name];
      }
      const viewport = this.availableViewports[name];
      if (viewport && viewport.acceptComponent(instruction.componentName)) {
        const found = this.foundViewport(viewports, this.scopeViewportParts, instruction, viewport);
        instructions.push(...found.viewportInstructions);
        viewportsRemaining = viewportsRemaining || found.viewportsRemaining;
        this.availableViewports[name] = null;
        Reflect.deleteProperty(this.scopeViewportParts, viewportPart);
      }
    }

    // Finally, only one accepting viewport left?
    for (const viewportPart in this.scopeViewportParts) {
      const instruction = this.router.instructionResolver.parseViewportInstruction(viewportPart);
      const remainingViewports: Viewport[] = [];
      for (const name in this.availableViewports) {
        const viewport: Viewport = this.availableViewports[name];
        if (viewport && viewport.acceptComponent(instruction.componentName)) {
          remainingViewports.push(viewport);
        }
      }
      if (remainingViewports.length === 1) {
        const viewport = remainingViewports.shift();
        const found = this.foundViewport(viewports, this.scopeViewportParts, instruction, viewport);
        instructions.push(...found.viewportInstructions);
        viewportsRemaining = viewportsRemaining || found.viewportsRemaining;
        this.availableViewports[viewport.name] = null;
        Reflect.deleteProperty(this.scopeViewportParts, viewportPart);
        break;
      }
    }

    viewportsRemaining = viewportsRemaining || Object.keys(this.scopeViewportParts).length > 0;

    // If it's a repeat there might be remaining viewports in scope children
    if (!viewports) {
      for (const child of this.children) {
        const found = child.findViewports();
        instructions.push(...found.viewportInstructions);
        viewportsRemaining = viewportsRemaining || found.viewportsRemaining;
      }
    }

    return {
      viewportInstructions: instructions,
      viewportsRemaining: viewportsRemaining,
    };
  }

  public foundViewport(viewports: Record<string, string | Viewport>, scopeViewportParts: Record<string, ViewportInstruction[][]>, instruction: ViewportInstruction, viewport: Viewport): IFindViewportsResult {
    const viewportPart = this.router.instructionResolver.stringifyViewportInstruction(instruction);
    instruction.setViewport(viewport);
    const instructions: ViewportInstruction[] = [instruction];
    let viewportsRemaining: boolean = false;

    if (scopeViewportParts[viewportPart].length) {
      const scope = viewport.scope || viewport.owningScope;
      for (const remainingParts of scopeViewportParts[viewportPart]) {
        if (remainingParts.length) {
          const remaining = this.router.instructionResolver.stringifyScopedViewportInstruction(remainingParts);
          const vps: Record<string, string | Viewport> = {};
          vps[remaining] = viewports[this.router.instructionResolver.stringifyScopedViewportInstruction([viewportPart, ...remainingParts])];
          const scoped = scope.findViewports(vps);
          instructions.push(...scoped.viewportInstructions);
          viewportsRemaining = viewportsRemaining || scoped.viewportsRemaining;
        }
      }
    }
    return {
      viewportInstructions: instructions,
      viewportsRemaining: viewportsRemaining,
    };
  }

  public addViewport(name: string, element: Element, context: IRenderContext, options?: IViewportOptions): Viewport {
    let viewport = this.getEnabledViewports()[name];
    // Each au-viewport element has its own Viewport
    if (element && viewport && viewport.element !== null && viewport.element !== element) {
      viewport.enabled = false;
      viewport = this.viewports.find(vp => vp.name === name && vp.element === element);
      if (viewport) {
        viewport.enabled = true;
      }
    }
    if (!viewport) {
      let scope: Scope;
      if (options.scope) {
        scope = new Scope(this.router, element, context, this);
        this.router.scopes.push(scope);
      }

      viewport = new Viewport(this.router, name, null, null, this, scope, options);
      this.viewports.push(viewport);
    }
    // TODO: Either explain why || instead of && here (might only need one) or change it to && if that should turn out to not be relevant
    if (element || context) {
      viewport.setElement(element, context, options);
    }
    return viewport;
  }
  public removeViewport(viewport: Viewport, element: Element, context: IRenderContext): number {
    if ((!element && !context) || viewport.remove(element, context)) {
      if (viewport.scope) {
        this.router.removeScope(viewport.scope);
      }
      this.viewports.splice(this.viewports.indexOf(viewport), 1);
    }
    return Object.keys(this.viewports).length;
  }

  public removeScope(): void {
    for (const child of this.children) {
      child.removeScope();
    }
    const viewports = this.getEnabledViewports();
    for (const name in viewports) {
      this.router.removeViewport(viewports[name], null, null);
    }
  }

  public renderViewport(viewport: Viewport): Promise<boolean> {
    return viewport.canEnter().then(() => viewport.loadContent());
  }

  public addChild(child: Scope): void {
    if (this.children.indexOf(child) < 0) {
      this.children.push(child);
    }
  }
  public removeChild(child: Scope): void {
    this.children.splice(this.children.indexOf(child), 1);
  }

  public viewportStates(full: boolean = false, active: boolean = false): string[] {
    const states: string[] = [];
    for (const vp in this.getEnabledViewports()) {
      const viewport: Viewport = this.getEnabledViewports()[vp];
      if ((viewport.options.noHistory || (viewport.options.noLink && !full)) && !active) {
        continue;
      }
      states.push(viewport.scopedDescription(full));
    }
    for (const scope of this.children) {
      states.push(...scope.viewportStates(full));
    }
    return states.filter((value) => value && value.length);
  }

  public allViewports(): Viewport[] {
    const viewports = this.viewports.filter((viewport) => viewport.enabled);
    for (const scope of this.children) {
      viewports.push(...scope.allViewports());
    }
    return viewports;
  }

  public scopeContext(full: boolean = false): string {
    if (!this.element || !this.parent) {
      return '';
    }
    const parents: string[] = [];
    if (this.viewport) {
      parents.unshift(this.viewport.description(full));
    }
    let viewport: Viewport = this.parent.closestViewport((this.context.get(IContainer) as ChildContainer).parent);
    while (viewport && viewport.owningScope === this.parent) {
      parents.unshift(viewport.description(full));
      viewport = this.closestViewport((viewport.context.get(IContainer) as ChildContainer).parent);
    }
    parents.unshift(this.parent.scopeContext(full));

    return this.router.instructionResolver.stringifyScopedViewportInstruction(parents.filter((value) => value && value.length));
  }

  private closestViewport(container: ChildContainer): Viewport {
    const viewports = Object.values(this.getEnabledViewports());
    while (container) {
      const viewport = viewports.find((item) => item.context.get(IContainer) === container);
      if (viewport) {
        return viewport;
      }
      container = container.parent;
    }
    return null;
  }
}
