/*:
 * @plugindesc Bodyguard System - protectors intercept attacks on a target enemy.
 * @author YourName
 *
 * @param Boss Index
 * @desc The enemy index (0-based) in the troop that is the boss.
 * @default 2
 *
 * @param Guard Indices
 * @desc Comma-separated indices of the bodyguard enemies.
 * @default 0,1
 *
 * @param Intercept Message
 * @desc Message shown the first time a bodyguard intercepts. Use %1 for guard name.
 * @default %1 steps in front to protect their master!
 */

(function() {
    var params = PluginManager.parameters('BodyguardSystem');
    var BOSS_INDEX    = Number(params['Boss Index'] || 2);
    var GUARD_INDICES = String(params['Guard Indices'] || '0,1').split(',').map(Number);
    var MESSAGE       = String(params['Intercept Message'] || 'Hehe.. Thank you Piggy.');

    var _hasShownMessage = false;
    var _queuedMessage = null;

    // Reset flag at the start of each battle
    var _BattleManager_startBattle = BattleManager.startBattle;
    BattleManager.startBattle = function() {
        _hasShownMessage = false;
        _queuedMessage = null;
        _BattleManager_startBattle.call(this);
    };

    // After all actions in a turn are done, show the queued message if any
    var _BattleManager_endTurn = BattleManager.endTurn;
    BattleManager.endTurn = function() {
        _BattleManager_endTurn.call(this);
        if (_queuedMessage) {
            showDialogue(_queuedMessage);
            _queuedMessage = null;
        }
    };

    var _Game_Action_makeTargets = Game_Action.prototype.makeTargets;
    Game_Action.prototype.makeTargets = function() {
        var targets = _Game_Action_makeTargets.call(this);

        if (this.isForOpponent() && this.subject().isActor()) {
            targets = targets.map(function(target) {
                return interceptIfBoss(target);
            });
        }
        return targets;
    };

    function interceptIfBoss(target) {
        var members = $gameTroop.members();
        var targetIndex = members.indexOf(target);

        if (targetIndex === BOSS_INDEX) {
            var aliveGuards = GUARD_INDICES
                .map(function(i) { return members[i]; })
                .filter(function(e) { return e && e.isAlive(); });

            if (aliveGuards.length > 0) {
                var guard = aliveGuards[Math.floor(Math.random() * aliveGuards.length)];

                if (!_hasShownMessage) {
                    _hasShownMessage = true;
                    _queuedMessage = MESSAGE.replace('%1', guard.name());
                }

                return guard;
            }
        }
        return target;
    }

    function showDialogue(text) {
        var _updateEvent = BattleManager.updateEvent;
        BattleManager.updateEvent = function() {
            if ($gameMessage.isBusy()) return true;
            BattleManager.updateEvent = _updateEvent;
            return _updateEvent.call(this);
        };

        $gameMessage.setBackground(0);
        $gameMessage.setPositionType(2);
        $gameMessage.add(text);
    }

})();