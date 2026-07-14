/*
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
*/

//=============================================================================
// TransformIfUnhit.js
//=============================================================================

/*:
 * @plugindesc Enemies silently transform if they survive a turn without taking
 * damage, and instantly revert if they take any HP damage at any point.
 *
 * @author Custom
 *
 * @help
 * ============================================================================
 * Note Tags (place on Enemy entries in the database)
 * ============================================================================
 *
 * <transformIfUnhit: X>
 *
 *   Adds one transformation stage. The enemy transforms into enemy ID X
 *   if it survives a full turn without taking any HP damage.
 *
 *   Stack multiple tags to create a chain:
 *
 *     <transformIfUnhit: 5>
 *     <transformIfUnhit: 8>
 *
 *   This means:
 *     Stage 1 → survive unhit → Stage 2 (enemy ID 5)
 *     Stage 2 → survive unhit → Stage 3 (enemy ID 8)
 *     Take any HP damage at any stage → instantly revert to Stage 1
 *
 * <transformLockAtFinal>
 *
 *   Once the enemy reaches its final transformation stage, it will no longer
 *   revert when hit. It stays in its final form for the rest of the battle.
 *
 *   Example (combined):
 *
 *     <transformIfUnhit: 5>
 *     <transformIfUnhit: 8>
 *     <transformLockAtFinal>
 *
 * ============================================================================
 * Notes
 * ============================================================================
 *
 * - Damage detection is immediate. Revert happens the instant HP drops.
 * - Transformation (surviving a turn) happens at turn end, silently.
 * - No messages or animations are shown at any point.
 * - Works independently per enemy — multiple copies in one troop are fine.
 * - Only HP-reducing hits count. States, debuffs, and 0-damage hits do not.
 * - HP is preserved as a percentage when transforming (no free heal/kill).
 * - Enemies that die from damage are allowed to die normally; they will not
 *   transform, revert, or be kept alive by this plugin.
 *
 */

(function() {

  'use strict';

  function parseTransformChain(enemyId) {
    var enemy = $dataEnemies[enemyId];
    if (!enemy || !enemy.note) return [];
    var chain = [];
    var re = /<transformIfUnhit:\s*(\d+)>/gi;
    var match;
    while ((match = re.exec(enemy.note)) !== null) {
      chain.push(parseInt(match[1]));
    }
    return chain;
  }

  function parseLockAtFinal(enemyId) {
    var enemy = $dataEnemies[enemyId];
    if (!enemy || !enemy.note) return false;
    return /<transformLockAtFinal>/i.test(enemy.note);
  }

  // ============================================================================
  // Game_Enemy — setup
  // ============================================================================

  var _Game_Enemy_setup = Game_Enemy.prototype.setup;
  Game_Enemy.prototype.setup = function(enemyId, x, y) {
    _Game_Enemy_setup.call(this, enemyId, x, y);
    this._originalEnemyId = enemyId;
    this._transformStage  = 0;
    this._wasHitThisTurn  = false;
    this._transformChain  = parseTransformChain(enemyId);
    this._transformLock   = parseLockAtFinal(enemyId);
    console.log('[TransformIfUnhit] setup enemyId=' + enemyId +
      ' chain=' + JSON.stringify(this._transformChain) +
      ' lock=' + this._transformLock);
  };

  // ============================================================================
  // Game_Enemy — silent swap
  // ============================================================================

  Game_Enemy.prototype._silentTransformTo = function(newEnemyId) {
    var newData = $dataEnemies[newEnemyId];
    if (!newData) {
      console.log('[TransformIfUnhit] _silentTransformTo: bad enemyId=' + newEnemyId);
      return;
    }
    console.log('[TransformIfUnhit] transforming ' + this._originalEnemyId +
      ' → ' + newEnemyId + ' (stage ' + this._transformStage + ')');

    var hpRatio = this.mhp > 0 ? this.hp / this.mhp : 1;
    var mpRatio = this.mmp > 0 ? this.mp / this.mmp : 1;

    this._enemyId     = newEnemyId;
    this._hp = Math.min(this.mhp, Math.max(1, Math.floor(this.mhp * hpRatio)));
    this._mp = Math.min(this.mmp, Math.floor(this.mmp * mpRatio));
    this._battlerName = newData.battlerName;
    this._battlerHue  = newData.battlerHue;

    if (SceneManager._scene && SceneManager._scene._spriteset) {
      var spriteset = SceneManager._scene._spriteset;
      if (spriteset._enemySprites) {
        spriteset._enemySprites.forEach(function(sprite) {
          if (sprite._enemy === this) sprite.updateBitmap();
        }, this);
      }
    }
  };

  // ============================================================================
  // Hook gainHp — fires the instant HP changes
  // ============================================================================

  var _Game_Battler_gainHp = Game_Battler.prototype.gainHp;
  Game_Battler.prototype.gainHp = function(value) {
    var hpBefore = this.hp;
    _Game_Battler_gainHp.call(this, value);

    if (!this.isEnemy()) return;

    console.log('[TransformIfUnhit] gainHp fired on enemy id=' + this._enemyId +
      ' hpBefore=' + hpBefore + ' hpAfter=' + this.hp +
      ' chain=' + JSON.stringify(this._transformChain));

    if (!this._transformChain || this._transformChain.length === 0) return;
    if (this.hp >= hpBefore) return; // no HP lost, ignore

    // NEW: if this damage killed the enemy, let it die normally —
    // do NOT transform/revert, since _silentTransformTo would force HP back to 1.
    if (this.hp <= 0 || this.isDead()) {
      console.log('[TransformIfUnhit] enemy died from this hit — skipping revert/transform');
      return;
    }

    this._wasHitThisTurn = true;
    console.log('[TransformIfUnhit] damage confirmed. stage=' + this._transformStage +
      ' lock=' + this._transformLock +
      ' atFinal=' + (this._transformStage >= this._transformChain.length));

    var atFinal = this._transformStage >= this._transformChain.length;
    if (this._transformLock && atFinal) {
      console.log('[TransformIfUnhit] locked at final — no revert');
      return;
    }

    if (this._transformStage > 0) {
      console.log('[TransformIfUnhit] reverting to original id=' + this._originalEnemyId);
      this._transformStage = 0;
      this._silentTransformTo(this._originalEnemyId);
    }
  };

  // ============================================================================
  // Hook turn end — advance stage if not hit
  // ============================================================================

  var _Game_Enemy_onTurnEnd = Game_Enemy.prototype.onTurnEnd;
  Game_Enemy.prototype.onTurnEnd = function() {
    _Game_Enemy_onTurnEnd.call(this);

    // NEW: dead enemies should never transform.
    if (this.isDead()) return;

    if (!this._transformChain || this._transformChain.length === 0) return;

    console.log('[TransformIfUnhit] onTurnEnd enemyId=' + this._enemyId +
      ' stage=' + this._transformStage +
      ' wasHit=' + this._wasHitThisTurn);

    if (!this._wasHitThisTurn) {
      var nextStage = this._transformStage + 1;
      if (nextStage <= this._transformChain.length) {
        this._transformStage = nextStage;
        this._silentTransformTo(this._transformChain[nextStage - 1]);
      }
    }

    this._wasHitThisTurn = false;
  };

})();