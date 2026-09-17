import { dispatchAosAction, reportDispatchError } from "./aos-adapter.mjs";
import { ACTION_NAMESPACE } from "./constants.mjs";

export function createRollHandler(
  coreModule,
  { dispatch = dispatchAosAction, reportError = reportDispatchError } = {}
) {
  return class RollHandlerAos extends coreModule.api.RollHandler {
    handleActionClick(event, buttonValue) {
      if (this.action?.system?.namespace !== ACTION_NAMESPACE) return false;

      // Core does not await this method. Capture the click context now, then
      // contain every asynchronous failure inside this handler.
      const action = {
        ...this.action,
        system: { ...this.action.system }
      };
      const context = {
        action,
        actor: this.actor,
        buttonValue,
        event,
        isRightClick: Boolean(this.isRightClick)
      };

      void (async () => {
        try {
          await dispatch(context);
        } catch (error) {
          try {
            reportError(error, context);
          } catch (reportingError) {
            console.error("token-action-hud-aos | Failed to report a dispatch error", {
              error,
              reportingError
            });
          }
        }
      })();

      return true;
    }
  };
}
