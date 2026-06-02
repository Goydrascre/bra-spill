/*:
 * @plugindesc v1.1.0 Lets you shift enemy battlers outside the boundaries of the Troop Window with notetags.
 * @author LadyBaskerville
 *
 * @param Default Shift X
 * @desc Default horizontal shift if no notetag is present
 * @default 0
 *
 * @param Default Shift Y
 * @desc Default vertical shift if no notetag is present
 * @default 0
 *
 * @help
 * ShiftEnemies.js
 * Version 1.1.0
 *
 * Use the following notetags in the enemy notebox:
 * <ShiftX: n> to shift the enemy n pixels to the right.
 * <ShiftY: n> to shift the enemy n pixels down.
 * Use negative values of n to shift the enemy in the opposite direction.
 *
 * If you want to offset many enemies by the same amount, you can specify
 * default values for Shift X and Shift Y in the Plugin Parameters.
 * Enemies without Shift notetags will be shifted by the values specified
 * in the parameters.
 *
 * Changelog:
 * Version 1.1.0
 * - Added Default parameters.
 * Version 1.0.0
 * - Finished the plugin.
 *
 * Free for use in both non-commercial and commercial games.
 * No credit required.
 * Edits and reposts allowed.
 */

(function() {

var defShiftX = Number(PluginManager.parameters('ShiftEnemies')['Default Shift X']) || 0;
var defShiftY = Number(PluginManager.parameters('ShiftEnemies')['Default Shift Y']) || 0;

_GameTroop_setup = Game_Troop.prototype.setup;
Game_Troop.prototype.setup = function(troopId) {
    _GameTroop_setup.call(this, troopId);
   this.shiftEnemies();
};

Game_Troop.prototype.shiftEnemies = function() {
   this._enemies.forEach(function(e) {
       if (e.enemy().meta.ShiftX) {
           e._screenX += Number(e.enemy().meta.ShiftX);
       } else {
           e._screenX += defShiftX;
       }
       if (e.enemy().meta.ShiftY) {
           e._screenY += Number(e.enemy().meta.ShiftY);
       } else {
           e._screenY += defShiftY;
       }
   }, this);
};

// Compatability
if (typeof Imported !== 'undefined' && Imported.YEP_BattleEngineCore) {
   Window_EnemyVisualSelect.prototype.makeWindowBoundaries = function() {
       if (!this._requestRefresh) return;
       this._minX = -1 * this.standardPadding();
       this._maxX = Graphics.boxWidth - this.width + this.standardPadding();
       this._minY = -1 * this.standardPadding();
       this._maxY = Graphics.boxHeight - this.height + this.standardPadding();
   };
}

})();