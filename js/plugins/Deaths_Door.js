(function() {

const MAIN_CHARACTER_ID = 1; 
const LAST_STAND_STATE_ID = 6; 

const _Game_Battler_gainHp = Game_Battler.prototype.gainHp;
Game_Battler.prototype.gainHp = function(value) {

    if (value < 0 && this.isActor()) {

        if (this._actorId !== MAIN_CHARACTER_ID) {

            const newHp = this.hp + value;

            if (newHp <= 0 && !this.isStateAffected(LAST_STAND_STATE_ID)) {
                this._hp = 1;
                this.addState(LAST_STAND_STATE_ID);
                return;
            }
        }
    }

    _Game_Battler_gainHp.call(this, value);
};

})();
(function() {

const _Game_Action_makeDamageValue = Game_Action.prototype.makeDamageValue;
Game_Action.prototype.makeDamageValue = function(target, critical) {
    
    let value = _Game_Action_makeDamageValue.call(this, target, critical);
    
    if (target.isActor() && target.tp === 0) {
        value *= 1.5; // 50% more damage at 0 stamina
    }
    
    return value;
};

})();
var _Game_Action_makeDamageValue = Game_Action.prototype.makeDamageValue;
Game_Action.prototype.makeDamageValue = function(target, critical) {
    var value = _Game_Action_makeDamageValue.call(this, target, critical);
    return Math.ceil(value);
};