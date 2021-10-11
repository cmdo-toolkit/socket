import type { Action } from "./Action";

/*
 |--------------------------------------------------------------------------------
 | Route
 |--------------------------------------------------------------------------------
 */

//#region

export class Route {
  public readonly event: string;
  public readonly actions: Action[];

  constructor(event: string, actions: Action[]) {
    this.event = event;
    this.actions = actions;
  }

  /*
   |--------------------------------------------------------------------------------
   | Factories
   |--------------------------------------------------------------------------------
   */

  //#region

  public static on(path: string, actions: Action[]): Route {
    return new Route(path, actions);
  }

  //#endregion
}

//#endregion
