var _SceneManager_pop = SceneManager.pop;

SceneManager.pop = function() {
    var scene = this._scene;

    if (scene instanceof Scene_Battle) {
        var bloodNeedle = $dataWeapons[5];

        $gameParty.members().forEach(function(actor) {

            // If Blood Needle is equipped
            if (actor.equips()[0] === bloodNeedle) {

                // Restore actor's default starting weapon from database
                var defaultWeaponId = actor.actor().equips[0];

                if (defaultWeaponId > 0) {
                    actor.changeEquip(0, $dataWeapons[defaultWeaponId]);
                } else {
                    actor.changeEquip(0, null);
                }
            }

            // Remove ALL Blood Needles from inventory
            if ($gameParty.hasItem(bloodNeedle)) {
                $gameParty.loseItem(
                    bloodNeedle,
                    $gameParty.numItems(bloodNeedle)
                );
            }

            actor.refresh();
        });
    }

    _SceneManager_pop.call(this);
};