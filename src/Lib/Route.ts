import type { Action } from "../Types/Action";

export class Route {
  public readonly event: string;
  public readonly actions: Action[];

  constructor(event: string, actions: Action[]) {
    this.event = event;
    this.actions = actions;
  }

  public static on(path: string, actions: Action[]): Route {
    return new Route(path, actions);
  }
}
