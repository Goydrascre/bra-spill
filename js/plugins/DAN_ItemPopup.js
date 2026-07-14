/*:
 * @plugindesc DAN Item Popups: Display item pickups with icons, names, and amounts in a configurable corner of the screen. Supports stacking, grouping duplicates, smooth fade, and multiple display modes.  
 * @author ChatGPT
 *
 * @help This plugin shows a popup whenever the player obtains an item, weapon, or armor.  
 * Features:  
 * - Configurable corner (top-left, top-right, bottom-left, bottom-right)  
 * - Max visible popups at once  
 * - Smooth fade out with optional delay between popups  
 * - Group same items into one popup with amount counter  
 * - Display modes: Text Only / Text + Icon / Icon Only (with xN for grouped items)  
 * - Customizable popup width, height, background color, and offset from screen edges  
 * - Popups are suppressed entirely while the party is in battle  
 *
 * @param Popup Width
 * @type number
 * @min 32
 * @default 280
 * @desc Width of each popup
 *
 * @param Popup Height
 * @type number
 * @min 32
 * @default 48
 * @desc Height of each popup
 *
 * @param Background Color
 * @type string
 * @default rgba(0,0,0,0.6)
 * @desc Fallback background color, used until the image loads (or if it's missing)
 *
 * @param Background Image
 * @type string
 * @default ItemPop
 * @desc Filename (no extension) of the popup background image, loaded from img/menus/
 *
 * @param Offset
 * @type number
 * @min 0
 * @default 20
 * @desc Distance from screen edges
 *
 * @param Display Mode
 * @type select
 * @option Text Only
 * @option Text + Icon
 * @option Icon Only
 * @default Text + Icon
 * @desc Choose whether popup shows text, icon, or both
 *
 * ============================================================================
 * Behavior Settings
 * ============================================================================
 * @param Corner
 * @type select
 * @option top-left
 * @option top-right
 * @option bottom-left
 * @option bottom-right
 * @default bottom-right
 * @desc Corner where popups appear
 *
 * @param Max Popups
 * @type number
 * @min 1
 * @default 5
 * @desc Maximum number of popups visible at once
 *
 * @param Duration
 * @type number
 * @min 10
 * @default 120
 * @desc Frames each popup stays visible
 *
 * @param Smooth Disappear
 * @type boolean
 * @on Yes
 * @off No
 * @default true
 * @desc Fade out smoothly instead of disappearing instantly
 *
 * @param Delay Between Popups
 * @type number
 * @min 0
 * @decimals 2
 * @default 0.5
 * @desc Seconds delay between popups fading
 *
 * @param Group Same Items
 * @type boolean
 * @on Yes
 * @off No
 * @default true
 * @desc Combine multiple pickups of same item into one popup with total amount
 *
 */
(function() {

  const params = PluginManager.parameters('DAN_ItemPopup');

  // --- Appearance ---
  const POP_W = Number(params['Popup Width'] || 280);
  const POP_H = Number(params['Popup Height'] || 48);
  const BG_COLOR = String(params['Background Color'] || 'rgba(0,0,0,0.6)');
  const BG_IMAGE = String(params['Background Image'] || 'ItemPop');
  const OFFSET = Number(params['Offset'] || 20);
  const DISPLAY_MODE = String(params['Display Mode'] || 'Text + Icon');

  // --- Behavior ---
  const CORNER = String(params['Corner'] || 'bottom-right');
  const MAX_POPUPS = Number(params['Max Popups'] || 5);
  const DURATION = Number(params['Duration'] || 120);
  const SMOOTH = params['Smooth Disappear'] === 'true';
  const DELAY = Number(params['Delay Between Popups'] || 0.5) * 60;
  const GROUP = params['Group Same Items'] === 'true';

  // --- Background image (img/menus/<Background Image>.png) ---
  let _bgBitmap = null;
  function getBgBitmap() {
    if (!_bgBitmap) {
      _bgBitmap = ImageManager.loadBitmap('img/menus/', BG_IMAGE);
    }
    return _bgBitmap;
  }

  // --- Game_Temp ---
  const _Game_Temp_initialize = Game_Temp.prototype.initialize;
  Game_Temp.prototype.initialize = function() {
    _Game_Temp_initialize.call(this);
    this._itemPopupQueue = [];
    this._activePopups = [];
  };

  Game_Temp.prototype.addItemPopup = function(item, amount) {
    if (!item || amount <= 0) return;

    // Don't queue or show popups while the party is in battle.
    if ($gameParty && $gameParty.inBattle()) return;

    if (GROUP) {
      const existing = this._itemPopupQueue.find(p => p.item === item);
      if (existing) {
        existing.amount += amount;
        return;
      }
      const activeExisting = this._activePopups.find(p => p._item === item);
      if (activeExisting) {
        activeExisting._amount += amount;
        activeExisting.createContents();
        return;
      }
    }

    this._itemPopupQueue.push({ item, amount, duration: DURATION });
  };

  const _Game_Party_gainItem = Game_Party.prototype.gainItem;
  Game_Party.prototype.gainItem = function(item, amount, includeEquip) {
    const before = this.numItems(item);
    _Game_Party_gainItem.call(this, item, amount, includeEquip);
    const after = this.numItems(item);
    if (!item || amount <= 0) return;
    const netGain = after - before;
    const isEquip = (DataManager.isWeapon(item) || DataManager.isArmor(item)) && includeEquip;
    if (netGain > 0 && !isEquip) {
      $gameTemp.addItemPopup(item, netGain);
    }
  };

  // --- Popup Sprite ---
  function ItemPopupSprite(item, amount, duration, fadeDelay) {
    Sprite.call(this);
    this._item = item;
    this._amount = amount;
    this._duration = duration || DURATION;
    this._expired = false;
    this._fadeDelay = fadeDelay || 0;
    this.bitmap = new Bitmap(POP_W, POP_H);
    this.createContents();
  }

  ItemPopupSprite.prototype = Object.create(Sprite.prototype);
  ItemPopupSprite.prototype.constructor = ItemPopupSprite;

  ItemPopupSprite.prototype.createContents = function() {
    const b = this.bitmap;
    b.clear();

    const bg = getBgBitmap();
    if (bg.isReady()) {
      if (bg.width > 0 && bg.height > 0) {
        b.blt(bg, 0, 0, bg.width, bg.height, 0, 0, POP_W, POP_H);
      } else {
        // Image failed to load (missing file) - fall back to flat color.
        b.fillRect(0, 0, POP_W, POP_H, BG_COLOR);
      }
    } else {
      b.fillRect(0, 0, POP_W, POP_H, BG_COLOR);
      bg.addLoadListener(() => {
        if (!this._expired) this.createContents();
      });
    }

    if (DISPLAY_MODE === 'Text + Icon' || DISPLAY_MODE === 'Icon Only') {
      if (this._item && typeof this._item.iconIndex === 'number') {
        const iconSet = ImageManager.loadSystem('IconSet');
        const ICON_SIZE = 32;
        const sx = (this._item.iconIndex % 16) * ICON_SIZE;
        const sy = Math.floor(this._item.iconIndex / 16) * ICON_SIZE;
        const iconX = 8;
        const iconY = Math.floor((POP_H - ICON_SIZE) / 2);
        b.blt(iconSet, sx, sy, ICON_SIZE, ICON_SIZE, iconX, iconY);

        if (DISPLAY_MODE === 'Icon Only' && GROUP && this._amount > 1) {
          b.fontSize = 16;
          b.textColor = '#ffffff';
          const txt = 'x' + this._amount;
          b.drawText(txt, iconX, iconY, ICON_SIZE, 16, 'right');
        }
      }
    }

    if (DISPLAY_MODE === 'Text + Icon' || DISPLAY_MODE === 'Text Only') {
      b.fontSize = 20;
      b.textColor = '#ffffff';
      const txt = this._item ? this._item.name + (this._amount > 1 && DISPLAY_MODE === 'Text + Icon' ? ' x' + this._amount : '') : '';
      const textX = (DISPLAY_MODE === 'Text + Icon') ? 8 + 32 + 8 : 8;
      b.drawText(txt, textX, 0, POP_W - textX - 8, POP_H, 'left');
    }
  };

  ItemPopupSprite.prototype.update = function() {
    Sprite.prototype.update.call(this);
    if (this._expired) return;

    if (this._fadeDelay > 0) {
      this._fadeDelay--;
      return;
    }

    this._duration--;
    this.y += (CORNER.includes('bottom') ? -0.25 : 0.25);

    if (SMOOTH) {
      if (this._duration < 30) this.opacity = Math.max(0, Math.floor((this._duration / 30) * 255));
      if (this._duration <= 0) this._expired = true;
    } else {
      if (this._duration <= 0) this._expired = true;
    }
  };

  // --- Scene_Base ---
  Scene_Base.prototype._ensureItemPopupContainer = function() {
    if (!this._itemPopupContainer) {
      this._itemPopupContainer = new Sprite();
      this.addChild(this._itemPopupContainer);
    }
    return this._itemPopupContainer;
  };

  Scene_Base.prototype.processItemPopups = function() {
    const container = this._ensureItemPopupContainer();
    if (!$gameTemp) return;

    for (let i = $gameTemp._activePopups.length - 1; i >= 0; i--) {
      const sp = $gameTemp._activePopups[i];
      if (sp._expired) {
        if (sp.bitmap && sp.bitmap.destroy) sp.bitmap.destroy();
        container.removeChild(sp);
        $gameTemp._activePopups.splice(i, 1);
      }
    }

    while ($gameTemp._itemPopupQueue.length > 0 && $gameTemp._activePopups.length < MAX_POPUPS) {
      const fadeDelay = $gameTemp._activePopups.length * DELAY;
      const data = $gameTemp._itemPopupQueue.shift();
      const sprite = new ItemPopupSprite(data.item, data.amount, data.duration, fadeDelay);
      container.addChild(sprite);
      $gameTemp._activePopups.push(sprite);
    }

    for (let i = 0; i < $gameTemp._activePopups.length; i++) {
      const sp = $gameTemp._activePopups[i];
      if (CORNER === 'bottom-right') {
        sp.x = Graphics.boxWidth - POP_W - OFFSET;
        sp.y = Graphics.boxHeight - (i + 1) * (POP_H + 8) - OFFSET;
      } else if (CORNER === 'bottom-left') {
        sp.x = OFFSET;
        sp.y = Graphics.boxHeight - (i + 1) * (POP_H + 8) - OFFSET;
      } else if (CORNER === 'top-right') {
        sp.x = Graphics.boxWidth - POP_W - OFFSET;
        sp.y = OFFSET + i * (POP_H + 8);
      } else if (CORNER === 'top-left') {
        sp.x = OFFSET;
        sp.y = OFFSET + i * (POP_H + 8);
      }
    }
  };

  const _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function() {
    _Scene_Map_update.call(this);
    this.processItemPopups();
  };

  // Note: Scene_Battle no longer hooks processItemPopups, so popups never
  // render during battle even if something manages to queue one.

  window.ItemPopup_test = function(itemId, amount, type) {
    const t = type || 'item';
    let data = $dataItems[itemId];
    if (t === 'weapon') data = $dataWeapons[itemId];
    if (t === 'armor') data = $dataArmors[itemId];
    if (!data) return;
    $gameParty.gainItem(data, amount || 1);
  };

})();