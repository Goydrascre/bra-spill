/*:
 * @plugindesc Bytter karakterens sideview battle-sprite basert på utstyrt våpen.
 * Bruk <BattlerImage: FILNAVN> i notetag-feltet på et våpen.
 * @author Claude
 *
 * @help
 * ============================================================================
 * Custom Battler Per Weapon
 * ============================================================================
 *
 * Denne pluginen bytter automatisk karakterens sideview battle-sprite
 * basert på hvilket våpen de har utstyrt. Perfekt når karakterene har
 * ulike høyder og posisjoner og du vil at våpenet skal se ut som det
 * sitter i hånden.
 *
 * Hver karakter må ha ett sprite-ark per våpen du vil støtte, plassert
 * i img/sv_actors/-mappen.
 *
 * ----------------------------------------------------------------------------
 * NOTETAGS - legg disse i notesfeltet på VÅPENET i databasen
 * ----------------------------------------------------------------------------
 *
 * <BattlerImage: FILNAVN>
 *   Bytt til dette sprite-arket når dette våpenet er utstyrt.
 *   Ikke ta med filendelse (.png).
 *   Eksempel: <BattlerImage: Actor1_sword>
 *
 * Du kan også legge notetag på KARAKTEREN (actor) for å sette
 * et standard fallback-bilde når ingen notetag finnes på våpenet:
 *
 * <DefaultBattler: FILNAVN>
 *   Eksempel: <DefaultBattler: Actor1_unarmed>
 *
 * ----------------------------------------------------------------------------
 * EKSEMPEL
 * ----------------------------------------------------------------------------
 *
 * Karakter "Erik" bruker normalt "Erik_default" som battler.
 * På karakteren i databasen:
 *   <DefaultBattler: Erik_default>
 *
 * Våpen "Katana" i databasen:
 *   <BattlerImage: Erik_katana>
 *
 * Våpen "Spyd" i databasen:
 *   <BattlerImage: Erik_spyd>
 *
 * Nå vil Erik automatisk bruke riktig sprite-ark i kamp basert på
 * hvilket våpen han har utstyrt!
 *
 * <ActorBattler X: FILNAVN>
 *   Sett sprite spesifikt for actor med ID X når dette våpenet er utstyrt.
 *   Eksempel: <ActorBattler 1: Erik_katana>
 *             <ActorBattler 2: Anna_katana>
 *
 * ============================================================================
 */

(function() {

    var _bitmapCache = {};

    // -----------------------------------------------------------------------
    // Hjelpefunksjoner
    // -----------------------------------------------------------------------

    function getActorBattlerTag(note, actorId) {
        var actorTag = '<actorbattler ' + actorId + ':';
        var lowerNote = note.toLowerCase();
        var idx = lowerNote.indexOf(actorTag);
        if (idx === -1) return null;
        var startIdx = idx + actorTag.length;
        var endIdx = note.indexOf('>', startIdx);
        if (endIdx === -1) return null;
        return note.substring(startIdx, endIdx).trim();
    }

    function getBattlerImageTag(note) {
        var match = note.match(/<BattlerImage:\s*(.+?)>/i);
        if (match) return match[1].trim();
        return null;
    }

    function getEquippedWeapon(actor) {
        if (!actor || !actor.weapons) return null;
        var weapons = actor.weapons();
        return (weapons && weapons.length > 0) ? weapons[0] : null;
    }

    function getBattlerImageFromWeapon(actor) {
        var weapon = getEquippedWeapon(actor);
        if (!weapon) return null;
        var note = weapon.note || '';
        var actorSpecific = getActorBattlerTag(note, actor.actorId());
        if (actorSpecific) return actorSpecific;
        return getBattlerImageTag(note);
    }

    function getDefaultBattlerFromActor(actor) {
        if (!actor) return null;
        var actorData = actor.actor();
        if (!actorData) return null;
        var note = actorData.note || '';
        var match = note.match(/<DefaultBattler:\s*(.+?)>/i);
        if (match) return match[1].trim();
        return null;
    }

    function getBattlerNameForWeaponItem(actor, item) {
        if (item && item.note) {
            var actorSpecific = getActorBattlerTag(item.note, actor.actorId());
            if (actorSpecific) return actorSpecific;
            var general = getBattlerImageTag(item.note);
            if (general) return general;
        }
        return getDefaultBattlerFromActor(actor) || actor.actor().battlerName;
    }

    function preloadBitmap(name) {
        if (!name || _bitmapCache[name]) return;
        _bitmapCache[name] = ImageManager.loadSvActor(name);
    }

    function getCachedBitmap(name) {
        if (!_bitmapCache[name]) {
            _bitmapCache[name] = ImageManager.loadSvActor(name);
        }
        return _bitmapCache[name];
    }

    // -----------------------------------------------------------------------
    // Pre-last ALLE våpen-sprites ved battle start
    // -----------------------------------------------------------------------

    var _Scene_Battle_start = Scene_Battle.prototype.start;
    Scene_Battle.prototype.start = function() {
        _Scene_Battle_start.call(this);
        $gameParty.members().forEach(function(actor) {
            var defaultName = getDefaultBattlerFromActor(actor);
            if (defaultName) preloadBitmap(defaultName);
            preloadBitmap(actor.actor().battlerName);
            $dataWeapons.forEach(function(weapon) {
                if (!weapon) return;
                var note = weapon.note || '';
                var actorSpecific = getActorBattlerTag(note, actor.actorId());
                if (actorSpecific) preloadBitmap(actorSpecific);
                var general = getBattlerImageTag(note);
                if (general) preloadBitmap(general);
            });
        });
    };

    // -----------------------------------------------------------------------
    // Override battlerName - returner fryst navn hvis satt
    // -----------------------------------------------------------------------

    var _Game_Actor_battlerName = Game_Actor.prototype.battlerName;
    Game_Actor.prototype.battlerName = function() {
        // Hvis vi har et fryst navn, returner det i stedet
        if (this._frozenBattlerName) {
            return this._frozenBattlerName;
        }
        if ($gameParty.inBattle()) {
            var weaponBattler = getBattlerImageFromWeapon(this);
            if (weaponBattler) return weaponBattler;
            var defaultBattler = getDefaultBattlerFromActor(this);
            if (defaultBattler) return defaultBattler;
        }
        return _Game_Actor_battlerName.call(this);
    };

    // -----------------------------------------------------------------------
    // changeEquip i kamp - frys gammel sprite, bytt equip, swap sprite atomisk
    // -----------------------------------------------------------------------

    var _Game_Actor_changeEquip = Game_Actor.prototype.changeEquip;
    Game_Actor.prototype.changeEquip = function(slotId, item) {
        if ($gameParty.inBattle() && !this._noEquipRefresh) {
            // Finn nytt bildnavn basert på item som skal utstyres
            var newName = getBattlerNameForWeaponItem(this, item);
            var bitmap = getCachedBitmap(newName);
            var self = this;

            // Frys det nåværende bildet så updateBitmap ikke switcher midt i
            this._frozenBattlerName = this.battlerName();

            var doSwap = function() {
                // Gjør selve equip-byttet
                self._noEquipRefresh = true;
                _Game_Actor_changeEquip.call(self, slotId, item);
                self._noEquipRefresh = false;

                // Oppdater sprite direkte med nytt bitmap
                self._frozenBattlerName = null;
                self._refreshBattlerSpriteImmediate(newName, bitmap);
            };

            if (bitmap.isReady()) {
                doSwap();
            } else {
                bitmap.addLoadListener(doSwap);
            }
        } else {
            _Game_Actor_changeEquip.call(this, slotId, item);
        }
    };

    var _Game_Actor_forceChangeEquip = Game_Actor.prototype.forceChangeEquip;
    Game_Actor.prototype.forceChangeEquip = function(slotId, item) {
        _Game_Actor_forceChangeEquip.call(this, slotId, item);
        if ($gameParty.inBattle()) {
            var newName = this.battlerName();
            this._refreshBattlerSpriteImmediate(newName, getCachedBitmap(newName));
        }
    };

    Game_Actor.prototype._refreshBattlerSpriteImmediate = function(name, bitmap) {
        if (!$gameParty.inBattle()) return;
        var spriteset = SceneManager._scene && SceneManager._scene._spriteset;
        if (!spriteset) return;
        var sprites = spriteset._actorSprites;
        if (!sprites) return;
        for (var i = 0; i < sprites.length; i++) {
            var sprite = sprites[i];
            if (sprite._actor === this) {
                sprite._battlerName = name;
                sprite._mainSprite.bitmap = bitmap;
                break;
            }
        }
    };

    // -----------------------------------------------------------------------
    // updateBitmap - respekter fryst navn
    // -----------------------------------------------------------------------

    var _Sprite_Actor_updateBitmap = Sprite_Actor.prototype.updateBitmap;
    Sprite_Actor.prototype.updateBitmap = function() {
        if (this._actor) {
            var name = this._actor.battlerName();
            if (this._battlerName !== name) {
                this._battlerName = name;
                this._mainSprite.bitmap = getCachedBitmap(name);
            }
        }
        _Sprite_Actor_updateBitmap.call(this);
    };

})();