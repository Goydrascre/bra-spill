//=============================================================================
// ZX_DashStamina_MV.js
//=============================================================================
/*:
 * @plugindesc [v1.3.0-MV] Dash stamina system with proportional speed and PIXI gauge.
 * @author Zim Xero (MV port)
 *
 * @param staminaVarId
 * @text Stamina Variable ID
 * @type variable
 * @default 6
 * @desc Variable that stores current stamina (0-max).
 *
 * @param enabledSwitchId
 * @text System Enabled Switch
 * @type switch
 * @default 4
 * @desc Turn this switch ON in-game to activate the stamina system.
 *
 * @param staminaMax
 * @text Stamina Max
 * @type number
 * @min 1
 * @default 300
 *
 * @param drainRate
 * @text Drain Rate (per second)
 * @type number
 * @decimals 1
 * @min 0
 * @default 40
 *
 * @param walkRecovery
 * @text Walk Recovery (per second)
 * @type number
 * @decimals 1
 * @min 0
 * @default 10
 *
 * @param standRecovery
 * @text Stand Recovery (per second)
 * @type number
 * @decimals 1
 * @min 0
 * @default 20
 *
 * @param baseMoveSpeed
 * @text Base Move Speed
 * @type number
 * @decimals 2
 * @min 1
 * @default 3.60
 * @desc Base walk speed. Full-stamina dash = base+1. Empty dash = base (no lockout).
 *
 * @param middleMouseDash
 * @text Middle Mouse Dash
 * @type boolean
 * @default true
 *
 * @param gaugeX
 * @text Gauge X Position
 * @type number
 * @default 20
 *
 * @param gaugeY
 * @text Gauge Y Position
 * @type number
 * @default 500
 *
 * @param gaugeWidth
 * @text Gauge Width (pixels)
 * @type number
 * @min 40
 * @default 60
 *
 * @param gaugeHeight
 * @text Gauge Height (pixels)
 * @type number
 * @min 80
 * @default 200
 *
 * @param gaugeUpdateInterval
 * @text Gauge Update Interval (frames)
 * @type number
 * @min 1
 * @default 6
 *
 * @param gaugeShape
 * @text Gauge Shape
 * @type select
 * @option arrow
 * @option rectangle
 * @default rectangle
 *
 * @param gaugeOrientation
 * @text Gauge Orientation
 * @type select
 * @option vertical
 * @option horizontal
 * @default vertical
 *
 * @param fillDirection
 * @text Fill Direction
 * @type select
 * @option tip-to-base
 * @option base-to-tip
 * @default tip-to-base
 *
 * @param gradientPreset
 * @text Gauge Color Gradient
 * @type select
 * @option Default (Orange to Purple)
 * @value default
 * @option Fire (Red to Yellow)
 * @value fire
 * @option Ice (Dark Blue to Cyan)
 * @value ice
 * @option Grayscale
 * @value grayscale
 * @option Gold
 * @value gold
 * @option Forest
 * @value forest
 * @option Neon
 * @value neon
 * @default default
 *
 * @param depletedOpacity
 * @text Depleted Segment Opacity (0-100)
 * @type number
 * @min 0
 * @max 100
 * @default 0
 *
 * @param trackStyle
 * @text Track Style
 * @type select
 * @option none
 * @option recessed
 * @option projection
 * @option super-projection
 * @default super-projection
 *
 * @param trackOpacity
 * @text Track Opacity (0-100)
 * @type number
 * @min 0
 * @max 100
 * @default 50
 *
 * @help
 * ZX_DashStamina_MV.js v1.3.0-MV
 *
 * SETUP
 *   1. Add plugin in Plugin Manager.
 *   2. Use a map Autorun/Parallel event to turn ON the enabled switch (default: 4).
 *   3. Gauge appears on screen and stamina drains when dashing (Shift key).
 *
 * Gauge renders at the very top of the PIXI stage so it always appears
 * above parallax layers, tilemap, characters, and windows.
 */
(function () {
    'use strict';

    var _PN = 'ZX_DashStamina_MV';
    var raw = PluginManager.parameters(_PN);

    function _n(val, def) { var v = Number(val); return (isNaN(v) || v === 0) ? def : v; }
    function _s(val, def) { return (val && String(val).trim() !== '') ? String(val).trim() : def; }

    var Params = {
        staminaVarId:        _n(raw['staminaVarId'],        6),
        enabledSwitchId:     _n(raw['enabledSwitchId'],     7),
        staminaMax:          _n(raw["staminaMax"],          100),
        drainRate:           _n(raw["drainRate"],           30),
        walkRecovery:        _n(raw['walkRecovery'],        10),
        standRecovery:       _n(raw['standRecovery'],       20),
        baseMoveSpeed:       _n(raw['baseMoveSpeed'],       3.6),
        middleMouseDash:     _s(raw['middleMouseDash'],     'true') !== 'false',
        gaugeX:              _n(raw['gaugeX'],              0),
        gaugeY:              _n(raw["gaugeY"],              20),
        gaugeWidth:          _n(raw["gaugeWidth"],          200),
        gaugeHeight:         _n(raw["gaugeHeight"],         0),
        gaugeUpdateInterval: _n(raw['gaugeUpdateInterval'], 6),
        gaugeShape:          _s(raw['gaugeShape'],          'rectangle'),
        gaugeOrientation:    _s(raw['gaugeOrientation'],    'horizontal'),
        fillDirection:       _s(raw['fillDirection'],       'base-to-tip'),
        gradientPreset:      _s(raw['gradientPreset'],      'default'),
        depletedOpacity:     _n(raw['depletedOpacity'],     30) / 100,
        trackStyle:          _s(raw['trackStyle'],          'super-projection'),
        trackOpacity:        _n(raw['trackOpacity'],        50) / 100,
    };

    // -------------------------------------------------------------------------
    // Color helpers
    // -------------------------------------------------------------------------
    function h2r(hex) {
        var h = hex.replace('#', '');
        return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
    }
    function r2h(r, g, b) { return (r << 16) | (g << 8) | b; }

    function interpolateStops(stops, count) {
        var out = [];
        for (var i = 0; i < count; i++) {
            var t      = i / (count - 1);
            var scaled = t * (stops.length - 1);
            var lo     = Math.floor(scaled);
            var hi     = Math.min(lo + 1, stops.length - 1);
            var frac   = scaled - lo;
            out.push(r2h(
                Math.round(stops[lo][0] + (stops[hi][0] - stops[lo][0]) * frac),
                Math.round(stops[lo][1] + (stops[hi][1] - stops[lo][1]) * frac),
                Math.round(stops[lo][2] + (stops[hi][2] - stops[lo][2]) * frac)
            ));
        }
        return out;
    }

    var _GP = {
        'default':   ['#7700AA','#5511BB','#3322CC','#1133BB','#0044AA','#0055BB','#0077CC','#0099DD','#00A8CC','#00AAAA','#00AA88','#22AA44','#44AA00','#77BB00','#AACF00','#DDDD00','#FFCC00','#FFB300','#FF9900','#FF8C00'],
        'fire':      ['#1A0000','#330000','#660000','#990000','#CC0000','#FF0000','#FF2200','#FF4400','#FF6600','#FF8800','#FFAA00','#FFBB00','#FFCC00','#FFDD00','#FFEE00','#FFFF00','#FFFF44','#FFFF88','#FFFFBB','#FFFFFF'],
        'ice':       ['#000033','#000066','#000099','#0000CC','#0022EE','#0044FF','#0066FF','#0088FF','#00AAFF','#00CCFF','#00DDFF','#00EEFF','#44EEFF','#88EEFF','#AAFFFF','#CCFFFF','#DFFFFF','#EFFFFF','#F5FFFF','#FFFFFF'],
        'grayscale': ['#000000','#0D0D0D','#1A1A1A','#2B2B2B','#3D3D3D','#4F4F4F','#616161','#747474','#888888','#9B9B9B','#ADADAD','#BEBEBE','#CCCCCC','#D5D5D5','#DEDEDE','#E6E6E6','#EEEEEE','#F2F2F2','#F7F7F7','#FFFFFF'],
        'gold':      ['#1A0A00','#331500','#4D2000','#663000','#804000','#995000','#B36000','#CC7700','#DD8800','#EE9900','#FFAA00','#FFBB11','#FFCC22','#FFCC44','#FFDD66','#FFDD88','#FFEEAA','#FFEECC','#FFF5DD','#FFFFEE'],
        'forest':    ['#0A0500','#1A0A00','#2B1100','#3D1A00','#4F2200','#2D3300','#1A4400','#005500','#006600','#007700','#008800','#119900','#22AA00','#44BB00','#66CC00','#88CC44','#AADD66','#CCEE88','#DDEEBB','#EEFFDD'],
        'neon':      ['#00FF00','#33FF00','#66FF00','#99FF00','#CCFF00','#FFFF00','#FFCC00','#FF9900','#FF6600','#FF3300','#FF0033','#FF0066','#FF0099','#FF00CC','#FF00FF','#CC00FF','#9900FF','#6600FF','#3300FF','#0000FF'],
    };


    function buildColors() {
        var preset = Params.gradientPreset;
        if (_GP[preset]) return _GP[preset].map(function(h){ return parseInt(h.replace('#',''), 16); });
        return _GP['default'].map(function(h){ return parseInt(h.replace('#',''), 16); });
    }

    // -------------------------------------------------------------------------
    // StaminaBar
    // -------------------------------------------------------------------------
    function StaminaBar(max) {
        this._max      = max;
        this._value    = max;
        this._fC       = 0;
        this._depleted = false; // true once fully emptied; cleared when full again
    }
    Object.defineProperty(StaminaBar.prototype, 'depleted', {
        get: function(){ return this._depleted; }
    });
    Object.defineProperty(StaminaBar.prototype, 'ratio', {
        get: function(){ return this._max > 0 ? this._value / this._max : 0; }
    });
    StaminaBar.prototype._adjust = function(perSec) {
        this._value = Math.max(0, Math.min(this._max, this._value + perSec / 60));
    };
    StaminaBar.prototype.update = function(isDashing, isWalking) {
        // While depleted, block dashing — always recover
        if (this._depleted) isDashing = false;
        if (isDashing)      this._adjust(-Params.drainRate);
        else if (isWalking) this._adjust(Params.walkRecovery);
        else                this._adjust(Params.standRecovery);
        // Enter depleted state when fully empty
        if (this._value <= 0) this._depleted = true;
        // Leave depleted state only when fully recovered
        if (this._depleted && this._value >= this._max) this._depleted = false;
        if (++this._fC >= Params.gaugeUpdateInterval) {
            this._fC = 0;
            if (Params.staminaVarId > 0 && $gameVariables)
                $gameVariables.setValue(Params.staminaVarId, Math.round(this._value));
        }
    };
    StaminaBar.prototype.toJSON   = function(){ return { value: this._value, max: this._max, depleted: this._depleted }; };
    StaminaBar.prototype.fromJSON = function(d) {
        if (!d) return;
        this._max   = (d.max   !== undefined) ? d.max   : this._max;
        this._value    = (d.value    !== undefined) ? d.value    : this._max;
        this._depleted = (d.depleted !== undefined) ? d.depleted : false;
    };

    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // StaminaGauge — simple solid bar
    // -------------------------------------------------------------------------
    var BAR_W = 110;
    var BAR_H = 12;
    var BAR_R = 3;

    function StaminaGauge() {
        PIXI.Container.call(this);
        this._lastRatio    = -1;
        this._lastDepleted = false;

        // Background track
        this._bg = new PIXI.Graphics();
        this._bg.beginFill(0x222222, 0.75);
        this._bg.drawRoundedRect(0, 0, BAR_W, BAR_H, BAR_R);
        this._bg.endFill();
        this.addChild(this._bg);

        // Fill bar
        this._fill = new PIXI.Graphics();
        this.addChild(this._fill);

        // Border image — loaded from img/menus/staminaBorder.png
        // The image is added on top so it overlays the bar like a frame.
        var bitmap = ImageManager.loadBitmap('img/menus/', 'staminaBorder', 0, true);
        var self = this;
        bitmap.addLoadListener(function() {
            var base    = new PIXI.BaseTexture(bitmap._canvas || bitmap._image);
            var texture = new PIXI.Texture(base);
            self._border        = new PIXI.Sprite(texture);
            self._border.x      = 0;
            self._border.y      = 0;
            self.addChild(self._border);
        });

        this.redraw(1.0);
    }
    StaminaGauge.prototype = Object.create(PIXI.Container.prototype);
    StaminaGauge.prototype.constructor = StaminaGauge;

    StaminaGauge.prototype.redraw = function(ratio, depleted) {
        var changed = Math.abs(ratio - this._lastRatio) >= 0.005 || depleted !== this._lastDepleted;
        if (!changed) return;
        this._lastRatio    = ratio;
        this._lastDepleted = depleted;
        var fillW = Math.max(0, Math.round(BAR_W * ratio));
        var color = depleted ? 0xAAEEAA : 0x217814; // light green while recovering, normal green otherwise
        this._fill.clear();
        if (fillW > 0) {
            this._fill.beginFill(color, 1.0);
            this._fill.drawRoundedRect(0, 0, fillW, BAR_H, BAR_R);
            this._fill.endFill();
        }
    };

    // -------------------------------------------------------------------------
    // Plugin state
    // -------------------------------------------------------------------------
    var _ZS = { bar: null, gauge: null, _mMD: false, _oMD: null, _oMU: null };

    function isEnabled() {
        return !!($gameSwitches && $gameSwitches.value(Params.enabledSwitchId));
    }

    function attachMouseDash() {
        if (!Params.middleMouseDash) return;
        _ZS._oMD = function(e) {
            if (e.button === 1) { e.preventDefault(); _ZS._mMD = true; if ($gameTemp) $gameTemp.clearDestination(); }
        };
        _ZS._oMU = function(e) { if (e.button === 1) { e.preventDefault(); _ZS._mMD = false; } };
        document.addEventListener('mousedown', _ZS._oMD);
        document.addEventListener('mouseup',   _ZS._oMU);
    }
    function detachMouseDash() {
        if (_ZS._oMD) {
            document.removeEventListener('mousedown', _ZS._oMD);
            document.removeEventListener('mouseup',   _ZS._oMU);
            _ZS._oMD = null; _ZS._oMU = null;
        }
        _ZS._mMD = false;
    }

    // -------------------------------------------------------------------------
    // Game_Player patches
    // -------------------------------------------------------------------------
    var _isDashing = Game_Player.prototype.isDashing;
    Game_Player.prototype.isDashing = function() {
        if (Params.middleMouseDash && _ZS._mMD) return true;
        return _isDashing.call(this);
    };

    Game_Player.prototype.realMoveSpeed = function() {
        if (!isEnabled()) {
            // Normal MV behaviour when system is off
            return this._moveSpeed + (this.isDashing() ? 1 : 0);
        }
        var bar = _ZS.bar;
        var ratio = bar ? bar.ratio : 1;
        var canDash = bar ? (!bar.depleted && ratio > 0) : true;
        return this.isDashing() && canDash ? Params.baseMoveSpeed + 1 : Params.baseMoveSpeed;
    };

    var _playerUpdate = Game_Player.prototype.update;
    Game_Player.prototype.update = function(sceneActive) {
        _playerUpdate.call(this, sceneActive);
        if (!isEnabled() || !_ZS.bar) return;
        var moving  = this.isMoving();
        var dashing = this.isDashing() && moving;
        var walking = !dashing && moving;
        _ZS.bar.update(dashing, walking);
    };

    // -------------------------------------------------------------------------
    // Gauge: attach directly to Graphics.app.stage — the absolute top of PIXI.
    // This renders above EVERYTHING: parallax, tilemap, characters, windows.
    // -------------------------------------------------------------------------
    function createGauge() {
        if (!_ZS.bar) _ZS.bar = new StaminaBar(Params.staminaMax);
        if (!_ZS.gauge) {
            _ZS.gauge = new StaminaGauge();
            _ZS.gauge.x = Params.gaugeX;
            _ZS.gauge.y = Params.gaugeY;
            _ZS.gauge.visible = false;
        }
        // Add to the current scene as the very last child = renders on top of everything
        var scene = SceneManager._scene;
        if (scene && _ZS.gauge.parent !== scene) {
            scene.addChild(_ZS.gauge);
        }
    }

    function updateGauge() {
        if (!_ZS.gauge) return;
        var enabled = isEnabled();
        if (!enabled) { _ZS.gauge.visible = false; return; }
        var bar  = _ZS.bar;
        var full = bar && bar.ratio >= 1.0 && !bar.depleted;
        _ZS.gauge.visible = !full;
        if (bar) _ZS.gauge.redraw(bar.ratio, bar.depleted);
    }

    var _sceneMapStart = Scene_Map.prototype.start;
    Scene_Map.prototype.start = function() {
        _sceneMapStart.call(this);
        createGauge();
        attachMouseDash();
    };

    var _sceneMapUpdate = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _sceneMapUpdate.call(this);
        updateGauge();
    };

    var _sceneMapTerminate = Scene_Map.prototype.terminate;
    Scene_Map.prototype.terminate = function() {
        _sceneMapTerminate.call(this);
        detachMouseDash();
        // Hide gauge when leaving map (battles, menus, etc.)
        if (_ZS.gauge) _ZS.gauge.visible = false;
    };

    // -------------------------------------------------------------------------
    // Save / Load
    // -------------------------------------------------------------------------
    var _makeSave = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function() {
        var c = _makeSave.call(this);
        c.zxStaminaBar = _ZS.bar ? _ZS.bar.toJSON() : null;
        return c;
    };

    var _extractSave = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function(c) {
        _extractSave.call(this, c);
        if (c.zxStaminaBar) {
            if (!_ZS.bar) _ZS.bar = new StaminaBar(Params.staminaMax);
            _ZS.bar.fromJSON(c.zxStaminaBar);
        }
    };

})();