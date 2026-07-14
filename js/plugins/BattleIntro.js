//=============================================================================
// CustomBattleTransition.js
//=============================================================================

/*:
 * @plugindesc v2.0 Replaces the default white flash when entering battle with a Common Event (e.g. a Show Picture flipbook animation).
 * @author (your name)
 *
 * @param Common Event ID
 * @desc The Common Event to run instead of the white flash (e.g. a Show Picture flipbook).
 * @type common_event
 * @default 10
 *
 * @param Disable White Flash
 * @desc Turn off the engine's built-in white screen flash.
 * @type boolean
 * @default true
 *
 * @param Keep Zoom Effect
 * @desc Keep the default zoom-in effect that plays alongside the flash.
 * @type boolean
 * @default true
 *
 * @param Transition Duration
 * @desc Total length (in frames, 60 = 1 second) of the map->battle transition. Raise this if your Common Event needs more time to finish.
 * @type number
 * @min 1
 * @default 60
 *
 * @help
 * ============================================================================
 * CustomBattleTransition.js
 * ============================================================================
 *
 * By default, RPG Maker MV plays a white screen flash (twice, in quick
 * succession) right before transitioning into Scene_Battle. This plugin
 * removes that flash and instead runs a Common Event of your choice at the
 * same moment - perfect for a short custom animation built with ordinary
 * "Show Picture" / "Wait" commands (a flipbook), no image-editor animation
 * cells required.
 *
 * SETUP
 * -----
 * 1. Build your Common Event as a flipbook:
 *      Show Picture: ID 90, "cloud_01", ...
 *      Wait: 4 frames
 *      Show Picture: ID 90, "cloud_02", ...   (same Picture ID replaces it)
 *      Wait: 4 frames
 *      ... etc ...
 *      Erase Picture: ID 90
 *    Use a high, unused Picture ID (e.g. 90+) so it can't collide with
 *    pictures your game already shows elsewhere.
 * 2. Set "Common Event ID" in the plugin parameters to that event.
 * 3. Leave "Disable White Flash" as true to fully remove the original flash.
 * 4. "Keep Zoom Effect" controls the camera zoom-in that normally plays
 *    alongside the flash. Set to false if you don't want any zoom at all.
 * 5. "Transition Duration" is the total time (in frames) the game spends on
 *    Scene_Map before cutting to Scene_Battle. The default is 60 (1 second),
 *    same as vanilla MV. Your whole Common Event (all its Wait commands
 *    combined) MUST finish before this runs out, or it will be interrupted
 *    partway through and resume/finish only when you return to the map
 *    later. For a short flipbook, count your total Wait frames and set this
 *    a little higher than that to leave a safety margin (e.g. 10 frames of
 *    4-frame waits = 40 frames of animation -> set Transition Duration to
 *    around 50-60).
 *
 * IMPORTANT
 * ---------
 * The Common Event runs on the map's own interpreter, so it keeps executing
 * normally during the fade-out into battle - you do not need to do anything
 * special to "wait" for it, just make sure Transition Duration is long
 * enough to contain it.
 *
 * COMPATIBILITY
 * -------------
 * This plugin overrides Scene_Map.prototype.updateEncounterEffect,
 * startEncounterEffect, encounterEffectSpeed, and startFlashForEncounter.
 * Place it below any other plugin that also modifies the battle-encounter
 * transition so this plugin's version takes priority (or above, if you want
 * the other plugin to win instead).
 *
 * No plugin commands. Free to use and modify in commercial or
 * non-commercial projects.
 * ============================================================================
 */

(function() {
    'use strict';

    var pluginName = 'CustomBattleTransition';
    var parameters = PluginManager.parameters(pluginName);

    var Params = {
        commonEventId: Number(parameters['Common Event ID'] || 10),
        disableFlash: String(parameters['Disable White Flash'] || 'true') === 'true',
        keepZoom: String(parameters['Keep Zoom Effect'] || 'true') === 'true',
        duration: Number(parameters['Transition Duration'] || 60)
    };

    //-----------------------------------------------------------------------
    // Scene_Map
    //-----------------------------------------------------------------------

    var _Scene_Map_startEncounterEffect = Scene_Map.prototype.startEncounterEffect;
    Scene_Map.prototype.startEncounterEffect = function() {
        _Scene_Map_startEncounterEffect.call(this);
        this._encounterCommonEventCalled = false;
    };

    Scene_Map.prototype.encounterEffectSpeed = function() {
        return Params.duration;
    };

    // Full rewrite of the original method so we can control exactly when
    // the Common Event fires relative to the zoom/fade timings.
    Scene_Map.prototype.updateEncounterEffect = function() {
        if (this._encounterEffectDuration > 0) {
            this._encounterEffectDuration--;
            var speed = this.encounterEffectSpeed();
            var n = speed - this._encounterEffectDuration;
            var p = n / speed;
            var q = ((p - 1) * 20 * p + 5) * p + 1;
            var zoomX = $gamePlayer.screenX();
            var zoomY = $gamePlayer.screenY() - 24;

            if (n === 2) {
                if (Params.keepZoom) {
                    $gameScreen.setZoom(zoomX, zoomY, 1);
                }
                this.snapForBattleBackground();
                this.startFlashForEncounter(speed / 2);
                this.callEncounterCommonEvent();
            }

            if (Params.keepZoom) {
                $gameScreen.setZoom(zoomX, zoomY, q);
            }

            if (n === Math.floor(speed / 6)) {
                this.startFlashForEncounter(speed / 2);
            }

            if (n === Math.floor(speed / 2)) {
                BattleManager.playBattleBgm();
                this.startFadeOut(this.fadeSpeed());
            }
        }
    };

    Scene_Map.prototype.startFlashForEncounter = function(duration) {
        if (Params.disableFlash) {
            return;
        }
        var color = [255, 255, 255, 255];
        $gameScreen.startFlash(color, duration);
    };

    Scene_Map.prototype.callEncounterCommonEvent = function() {
        if (this._encounterCommonEventCalled) {
            return;
        }
        this._encounterCommonEventCalled = true;
        if (Params.commonEventId > 0) {
            // Reserves the Common Event so the map's interpreter picks it
            // up on its next update - it will keep running normally
            // (including all its Wait commands) while the rest of the
            // encounter transition (zoom/fade) plays out on top of it.
            $gameTemp.reserveCommonEvent(Params.commonEventId);
        }
    };

})();