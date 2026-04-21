(function() {

const BOSS_INDEX = 0;     
const ARM_INDEXES = [1,2,3]; 
const RESPAWN_TURNS = 2;   

let deathTurns = {};

const _Game_Battler_die = Game_Battler.prototype.die;
Game_Battler.prototype.die = function() {
    _Game_Battler_die.call(this);

    if (this.isEnemy()) {
        const index = $gameTroop.members().indexOf(this);
        if (ARM_INDEXES.includes(index)) {
            deathTurns[index] = $gameTroop.turnCount();
        }
    }
};

const _BattleManager_endTurn = BattleManager.endTurn;
BattleManager.endTurn = function() {
    _BattleManager_endTurn.call(this);

    const boss = $gameTroop.members()[BOSS_INDEX];
    if (!boss || !boss.isAlive()) return;

    ARM_INDEXES.forEach(index => {
        const arm = $gameTroop.members()[index];
        if (!arm) return;

        if (arm.isDead() && deathTurns[index] !== undefined) {
            if ($gameTroop.turnCount() - deathTurns[index] >= RESPAWN_TURNS) {
                arm.revive();
                arm.setHp(arm.mhp);
                deathTurns[index] = undefined;
            }
        }
    });
};

})();