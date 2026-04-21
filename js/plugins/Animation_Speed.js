/*:
 * @plugindesc Controls the animation speed of sideview battlers.
 * Higher values = slower animation (default is 12).
 * @author Claude
 *
 * @param Default Motion Speed
 * @desc Animation speed for all actors. Default MV value is 12.
 * Higher = slower. Lower = faster.
 * @default 12
 *
 * @help
 * ============================================================================
 * Battler Motion Speed
 * ============================================================================
 *
 * Changes how fast the sideview battle animations play.
 * The default RPG Maker MV value is 12.
 *
 * Higher number = slower animation (each frame is held longer)
 * Lower number  = faster animation
 *
 * Examples:
 *   6  = twice as fast as default
 *   12 = default speed
 *   24 = twice as slow as default
 *
 * You can also set speed per actor using a notetag on the actor in the
 * database, which overrides the global setting:
 *
 * <MotionSpeed: X>
 *   Example: <MotionSpeed: 20>
 *
 * ============================================================================
 */

(function() {

    var parameters = PluginManager.parameters('BattlerMotionSpeed');
    var defaultSpeed = Number(parameters['Default Motion Speed'] || 12);

    Sprite_Actor.prototype.motionSpeed = function() {
        // Check for per-actor notetag
        if (this._actor) {
            var actorData = this._actor.actor();
            if (actorData) {
                var match = actorData.note.match(/<MotionSpeed:\s*(\d+)>/i);
                if (match) {
                    return parseInt(match[1]);
                }
            }
        }
        return defaultSpeed;
    };

})();