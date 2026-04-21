/*:
 * @plugindesc Change the actor's position in a side battle with notetags.
 * @author AdamElDev
 *
 * @help Change the actor's position in a side battle with notetags.
 *
 * To use it, type the following notetag in "Actors":
 *<BattlePosition>
 *ActorX = [X coordinate]
 *ActorY = [Y coordinate]
 *
 *
 *
 */
//AdamElDev plugin//
//https://adameldev.itch.io//
(function() {
    var parameters = PluginManager.parameters('BattlePosition');

    var _Game_Actor_initMembers = Game_Actor.prototype.initMembers;
    Game_Actor.prototype.initMembers = function() {
        _Game_Actor_initMembers.call(this);
        this._battlePositionX = 0;
        this._battlePositionY = 0;
    };
//AdamElDev plugin//
//https://adameldev.itch.io//
    var _Game_Actor_setup = Game_Actor.prototype.setup;
    Game_Actor.prototype.setup = function(actorId) {
        _Game_Actor_setup.call(this, actorId);
        this.parseBattlePosition();
    };
//AdamElDev plugin//
//https://adameldev.itch.io//
    Game_Actor.prototype.parseBattlePosition = function() {
        var note = this.actor().note;
        var match = /<BattlePosition>\s*ActorX\s*=\s*(\d+)\s*ActorY\s*=\s*(\d+)/i.exec(note);
        if (match) {
            this._battlePositionX = parseInt(match[1]);
            this._battlePositionY = parseInt(match[2]);
        }
    };
//AdamElDev plugin//
//https://adameldev.itch.io//
    var _Sprite_Actor_setActorHome = Sprite_Actor.prototype.setActorHome;
    Sprite_Actor.prototype.setActorHome = function(index) {
        if (this._actor && this._actor._battlePositionX && this._actor._battlePositionY) {
            this.setHome(this._actor._battlePositionX, this._actor._battlePositionY);
        } else {
            _Sprite_Actor_setActorHome.call(this, index);
        }
    };
})();
//AdamElDev plugin//
//https://adameldev.itch.io//