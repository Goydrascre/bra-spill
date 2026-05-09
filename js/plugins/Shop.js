/*:
 * @plugindesc Tilpasset butikk-layout: vareliste venstre, bilde høyre, infoboks nederst.
 * @author Tilpasset
 *
 * @param ShopkeeperImage
 * @text Standard butikkmann-bilde
 * @desc Filnavn i img/pictures/ (uten .png)
 * @default Actor1
 *
 * @param ShopkeeperLines
 * @text Varelinjer (skill med |)
 * @desc En linje per vare i rekkefølge, skill med |
 * @default Dette er et godt valg!|Sterkt og pålitelig.|Perfekt for eventyrere.|En klassiker.|Anbefales!
 *
 * @help
 * Plugin-kommando FØR Shop Processing:
 *   SetShopkeeper <bilde> <linje1>|<linje2>|<linje3>
 * Eksempel:
 *   SetShopkeeper Smed Sterkt staal!|Beste sverd i byen.|Ingen bedre!
 */

(function () {
    'use strict';

    var params   = PluginManager.parameters('CustomShopLayout');
    var defImage = String(params['ShopkeeperImage'] || 'Actor1');
    var defLines = String(params['ShopkeeperLines'] || 'Et godt valg!|Sterkt og pålitelig.|Perfekt!');

    // Bruk ett objekt med image og lines – oppdater properties direkte
    var gSK = { image: defImage, lines: defLines.split('|') };

    //------------------------------------------------------
    // Plugin-kommando – oppdater properties i stedet for å lage nytt objekt
    //------------------------------------------------------
    var _pluginCmd = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (cmd, args) {
        _pluginCmd.call(this, cmd, args);
        if (cmd === 'SetShopkeeper') {
            gSK.image = args[0] || defImage;
            var rest  = args.slice(1).join(' ');
            gSK.lines = rest ? rest.split('|') : defLines.split('|');
            // Oppdater bilde og infoboks hvis scenen er aktiv
            var scene = SceneManager._scene;
            if (scene && scene._bgSprite) {
                scene._loadBgSprite(gSK.image);
            }
        }
    };

    //------------------------------------------------------
    // Størrelser
    //------------------------------------------------------
    function lh()    { return Window_Base.prototype.lineHeight(); }
    function pad()   { return Window_Base.prototype.standardPadding(); }
    function infoH() { return lh() * 3 + pad() * 2; }
    function listW() { return Math.floor(Graphics.boxWidth * 0.42); }

    //------------------------------------------------------
    // Window_ShopCommand – begrens bredde til listW()
    //------------------------------------------------------
    Window_ShopCommand.prototype.windowWidth = function () {
        return listW();
    };

    //------------------------------------------------------
    // Window_ShopSell – filtrer basert på _category
    //------------------------------------------------------
    Window_ShopSell.prototype.includes = function (item) {
        if (!item) return false;
        var cat = this._category;
        if (cat === 'item')   return DataManager.isItem(item) && item.itypeId === 1;
        if (cat === 'weapon') return DataManager.isWeapon(item);
        if (cat === 'armor')  return DataManager.isArmor(item);
        return false;
    };

    Window_ShopSell.prototype.setCategory = function (cat) {
        this._category = cat;
        this.refresh();
        this.resetScroll();
    };

    Window_ShopSell.prototype.maxCols = function () { return 1; };

    //------------------------------------------------------
    // Scene_Shop.create
    //------------------------------------------------------
    var _create = Scene_Shop.prototype.create;
    Scene_Shop.prototype.create = function () {
        _create.call(this);

        var lw    = listW();
        var rw    = Graphics.boxWidth - lw;
        var ih    = infoH();
        var cmdH  = this._commandWindow.height;
        var catH  = this._commandWindow.height;
        var midH  = Graphics.boxHeight - cmdH - ih;
        var sellH = Graphics.boxHeight - cmdH - catH - ih;

        // -- Kommandovindu
        this._commandWindow.x = 0;
        this._commandWindow.y = 0;

        // -- Gullvindu: gjøm (vi viser gull i infoboksen)
        this._goldWindow.x = Graphics.boxWidth + 100;

        // -- Kjøpevindu
        this._buyWindow.x      = 0;
        this._buyWindow.y      = cmdH;
        this._buyWindow.width  = lw;
        this._buyWindow.height = midH;
        this._buyWindow.createContents();
        this._buyWindow.refresh();

        // -- Selgevindu
        this._sellWindow.x         = 0;
        this._sellWindow.y         = cmdH + catH;
        this._sellWindow.width     = lw;
        this._sellWindow.height    = sellH;
        this._sellWindow._category = 'weapon';
        this._sellWindow.createContents();
        this._sellWindow.refresh();
        // Koble sell-vinduets handlers
        this._sellWindow.setHandler('ok',     this.onSellOk.bind(this));
        this._sellWindow.setHandler('cancel', this.onSellCancel.bind(this));

        // -- Dummy-vindu
        if (this._dummyWindow) {
            this._dummyWindow.x      = 0;
            this._dummyWindow.y      = cmdH;
            this._dummyWindow.width  = lw;
            this._dummyWindow.height = midH;
            this._dummyWindow.createContents();
        }

        // -- Nummervindu
        if (this._numberWindow) {
            this._numberWindow.x      = 0;
            this._numberWindow.y      = cmdH;
            this._numberWindow.width  = lw;
            this._numberWindow.height = midH;
            this._numberWindow.createContents();
        }

        // -- Statusvindu og helpvindu: gjøm
        if (this._statusWindow) this._statusWindow.x = Graphics.boxWidth + 100;
        if (this._helpWindow)   this._helpWindow.x   = Graphics.boxWidth + 100;

        // -- Kategori-vindu
        this._shopCategoryWindow = new Window_ShopSellCategory(0, cmdH, lw, catH);
        this._shopCategoryWindow.hide();
        this._shopCategoryWindow.deactivate();
        this._shopCategoryWindow.setHandler('ok',     this.onShopCatOk.bind(this));
        this._shopCategoryWindow.setHandler('cancel', this.onShopCatCancel.bind(this));
        this.addWindow(this._shopCategoryWindow);

        // -- Usynlig placeholder for høyre side
        this._skWindow = new Window_ShopKeeper(lw, 0, rw, Graphics.boxHeight - ih, gSK);
        this.addWindow(this._skWindow);

        // -- Infoboks – peker på gSK direkte
        this._infoWindow = new Window_ShopInfo(0, Graphics.boxHeight - ih, Graphics.boxWidth, ih, gSK);
        this.addWindow(this._infoWindow);

        // -- Bakgrunnsbilde
        this._bgSprite = new Sprite();
        this._bgSprite.x = 0;
        this._bgSprite.y = 0;
        this.addChildAt(this._bgSprite, 1);
        this._loadBgSprite(gSK.image);
    };

    Scene_Shop.prototype._loadBgSprite = function (imageName) {
        if (!imageName) return;
        var self = this;
        var bmp  = ImageManager.loadPicture(imageName);
        bmp.addLoadListener(function () {
            self._bgSprite.bitmap  = bmp;
            self._bgSprite.scale.x = Graphics.boxWidth  / bmp.width;
            self._bgSprite.scale.y = Graphics.boxHeight / bmp.height;
        });
    };

    //------------------------------------------------------
    // Blokker MV sine egne handlers som forstyrrer
    //------------------------------------------------------
    Scene_Shop.prototype.activateSellWindow  = function () {};
    Scene_Shop.prototype.onCategoryOk        = function () {};
    Scene_Shop.prototype.onCategoryCancel    = function () {};
    // La MV lage _categoryWindow normalt, men avskjær setItemWindow
    // så den ikke kobler seg til _sellWindow og styrer synligheten.
    var _createCategoryWindow = Scene_Shop.prototype.createCategoryWindow;
    Scene_Shop.prototype.createCategoryWindow = function () {
        _createCategoryWindow.call(this);
        // Overstyr setItemWindow på den ferdige categoryWindow til å ikke gjøre noe
        this._categoryWindow.setItemWindow = function() {};
        // Gjøm og deaktiver den – vi bruker vår egen _shopCategoryWindow
        this._categoryWindow.hide();
        this._categoryWindow.deactivate();
        this._categoryWindow.x = Graphics.boxWidth + 100;
    };

    //------------------------------------------------------
    // commandBuy – velg første item automatisk
    //------------------------------------------------------
    Scene_Shop.prototype.commandBuy = function () {
        this._dummyWindow.hide();
        this._shopCategoryWindow.hide();
        this._sellWindow.close();
        this._buyWindow.setMoney(this.money());
        this._buyWindow.show();
        this._buyWindow.activate();
        this._buyWindow.select(0);  // FIX: velg første item med en gang
    };

    Scene_Shop.prototype.commandSell = function () {
        this._dummyWindow.hide();
        this._buyWindow.deselect();
        this._shopCategoryWindow.show();
        this._shopCategoryWindow.activate();
        this._shopCategoryWindow.select(0);
        this._sellWindow.open();
        this._sellWindow.show();
        this._sellWindow.deactivate();
        this._sellWindow.deselect();
        this._sellWindow.setCategory(this._shopCategoryWindow.currentSymbol());
    };

    //------------------------------------------------------
    // Kategori-handlers
    //------------------------------------------------------
    Scene_Shop.prototype.onShopCatOk = function () {
        var cat = this._shopCategoryWindow.currentSymbol();
        this._sellWindow.setCategory(cat);
        this._sellWindow.activate();
        this._sellWindow.select(0);
        this._shopCategoryWindow.deactivate();
    };

    Scene_Shop.prototype.onShopCatCancel = function () {
        this._shopCategoryWindow.hide();
        this._shopCategoryWindow.deactivate();
        this._sellWindow.close();
        this._sellWindow.deselect();
        this._dummyWindow.show();
        this._commandWindow.activate();
    };

    //------------------------------------------------------
    // Sell-handlers
    //------------------------------------------------------
    Scene_Shop.prototype.onSellOk = function () {
        this._item = this._sellWindow.item();
        this.doSell(1);
        this._goldWindow.refresh();
        this._sellWindow.refresh();
        this._sellWindow.activate();
        SoundManager.playShop();
    };

    Scene_Shop.prototype.onSellCancel = function () {
        this._sellWindow.deactivate();
        this._sellWindow.deselect();
        this._shopCategoryWindow.activate();
    };

    //------------------------------------------------------
    // Buy-handlers
    //------------------------------------------------------
    Scene_Shop.prototype.onBuyOk = function () {
        this._item = this._buyWindow.item();
        this.doBuy(1);
        this._buyWindow.setMoney(this.money());
        this._buyWindow.refresh();
        this._buyWindow.activate();
        this._infoWindow.refresh();
        SoundManager.playShop();
    };

    Scene_Shop.prototype.onBuyCancel = function () {
        this._commandWindow.activate();
        this._dummyWindow.show();
        this._buyWindow.deselect();
    };

    //------------------------------------------------------
    // Number-handlers
    //------------------------------------------------------
    Scene_Shop.prototype.onNumberOk = function () {
        SoundManager.playShop();
        switch (this._commandWindow.currentSymbol()) {
        case 'buy':
            this.doBuy(this._numberWindow.number());
            break;
        case 'sell':
            this.doSell(this._numberWindow.number());
            break;
        }
        this._numberWindow.hide();
        this._goldWindow.refresh();
        switch (this._commandWindow.currentSymbol()) {
        case 'buy':
            this._buyWindow.setMoney(this.money());
            this._buyWindow.refresh();
            this._buyWindow.activate();
            break;
        case 'sell':
            this._sellWindow.refresh();
            this._sellWindow.deselect();
            this._shopCategoryWindow.activate();
            break;
        }
    };

    Scene_Shop.prototype.onNumberCancel = function () {
        SoundManager.playCancel();
        this._numberWindow.hide();
        switch (this._commandWindow.currentSymbol()) {
        case 'buy':
            this._buyWindow.activate();
            break;
        case 'sell':
            this._sellWindow.activate();
            break;
        }
    };

    //------------------------------------------------------
    // Update – infoboks
    //------------------------------------------------------
    var _update = Scene_Shop.prototype.update;
    Scene_Shop.prototype.update = function () {
        _update.call(this);
        if (!this._infoWindow) return;

        // Forhindre at MV gjemmer sell-vinduet etter at vi viser det
        var inSellMode = this._shopCategoryWindow && !this._shopCategoryWindow._hidden;
        if (inSellMode && this._sellWindow && this._sellWindow._hidden) {
            this._sellWindow.show();
            this._sellWindow.open();
        }

        var buying  = this._buyWindow  && this._buyWindow.active;
        var selling = this._sellWindow && this._sellWindow.active;
        var win     = buying ? this._buyWindow : (selling ? this._sellWindow : null);
        var item    = win && win.item  ? win.item()  : null;
        var index   = win && win.index ? win.index() : 0;
        this._infoWindow.setItem(item, index, buying);
        // Oppdater gull-visning hvert frame
        if (this._infoWindow) this._infoWindow.refreshGold();
    };

    //------------------------------------------------------
    // Window_ShopSellCategory
    //------------------------------------------------------
    function Window_ShopSellCategory(x, y, w, h) {
        this.initialize.call(this, x, y, w, h);
    }
    Window_ShopSellCategory.prototype             = Object.create(Window_Command.prototype);
    Window_ShopSellCategory.prototype.constructor = Window_ShopSellCategory;

    Window_ShopSellCategory.prototype.initialize = function (x, y, w, h) {
        this._windowWidth  = w;
        this._windowHeight = h;
        Window_Command.prototype.initialize.call(this, x, y);
    };

    Window_ShopSellCategory.prototype.windowWidth    = function () { return this._windowWidth; };
    Window_ShopSellCategory.prototype.windowHeight   = function () { return this._windowHeight; };
    Window_ShopSellCategory.prototype.numVisibleRows = function () { return 1; };
    Window_ShopSellCategory.prototype.maxCols        = function () { return 3; };

    Window_ShopSellCategory.prototype.makeCommandList = function () {
        this.addCommand(TextManager.item,   'item');
        this.addCommand(TextManager.weapon, 'weapon');
        this.addCommand(TextManager.armor,  'armor');
    };

    Window_ShopSellCategory.prototype.itemRect = function (index) {
        var w = Math.floor(this.contents.width / 3);
        var h = this.itemHeight();
        return new Rectangle(index * w, 0, w, h);
    };

    Window_ShopSellCategory.prototype.drawItem = function (index) {
        var rect = this.itemRect(index);
        var w = Math.floor(this.contents.width / 3);
        this.resetTextColor();
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.drawText(this.commandName(index), index * w, 0, w, 'center');
        this.changePaintOpacity(true);
    };

    //------------------------------------------------------
    // Window_ShopKeeper – usynlig placeholder
    //------------------------------------------------------
    function Window_ShopKeeper(x, y, w, h, sk) {
        this.initialize.call(this, x, y, w, h, sk);
    }
    Window_ShopKeeper.prototype             = Object.create(Window_Base.prototype);
    Window_ShopKeeper.prototype.constructor = Window_ShopKeeper;

    Window_ShopKeeper.prototype.initialize = function (x, y, w, h, sk) {
        Window_Base.prototype.initialize.call(this, x, y, w, h);
        this.opacity         = 0;
        this.contentsOpacity = 0;
        this._sk = sk;
    };

    Window_ShopKeeper.prototype.refresh = function () {};

    //------------------------------------------------------
    // Window_ShopInfo – infoboks nederst
    //------------------------------------------------------
    function Window_ShopInfo(x, y, w, h, sk) {
        this.initialize.call(this, x, y, w, h, sk);
    }
    Window_ShopInfo.prototype             = Object.create(Window_Base.prototype);
    Window_ShopInfo.prototype.constructor = Window_ShopInfo;

    Window_ShopInfo.prototype.initialize = function (x, y, w, h, sk) {
        Window_Base.prototype.initialize.call(this, x, y, w, h);
        this._sk     = sk;  // peker direkte på gSK – oppdateres automatisk
        this._item   = null;
        this._index  = 0;
        this._buying = false;
    };

    Window_ShopInfo.prototype.setItem = function (item, index, buying) {
        if (this._item === item && this._index === index && this._buying === buying) return;
        this._item   = item;
        this._index  = index || 0;
        this._buying = buying;
        this.refresh();
    };

    Window_ShopInfo.prototype.refreshGold = function () {
        var gold = $gameParty ? $gameParty.gold() : 0;
        if (this._lastGold === gold) return;
        this._lastGold = gold;
        this.refresh();
    };

    Window_ShopInfo.prototype.refresh = function () {
        this.contents.clear();
        var cw = this.contents.width;

        // Gull alltid nederst til høyre
        var gold = $gameParty ? $gameParty.gold() : 0;
        this.changeTextColor(this.systemColor());
        this.drawText(TextManager.currencyUnit, cw - 160, lh() * 2, 80, 'right');
        this.resetTextColor();
        this.drawText(gold, cw - 80, lh() * 2, 80, 'right');

        if (!this._item) return;

        // Linje 1: varenavn
        this.changeTextColor(this.systemColor());
        this.drawText(this._item.name, 0, 0, cw - 170);
        this.resetTextColor();

        // Linje 2: beskrivelse
        this.drawText(this._item.description || '', 0, lh(), cw - 170);

        // Linje 3: pris eller butikkmann-linje
        if (this._buying) {
            var lines = (this._sk && this._sk.lines.length > 0) ? this._sk.lines : [];
            var line  = lines.length > 0 ? lines[this._index % lines.length] : '';
            this.changeTextColor(this.textColor(6));
            this.drawText('"' + line + '"', 0, lh() * 2, cw - 170);
            this.resetTextColor();
        } else {
            // Selling: vis salgspris
            var sellPrice = Math.floor(this._item.price / 2);
            this.changeTextColor(this.systemColor());
            this.drawText(TextManager.currencyUnit + ': ' + sellPrice, 0, lh() * 2, cw - 170);
            this.resetTextColor();
        }
    };

    //------------------------------------------------------
    // Window_ShopSell – ikon + navn + antall + salgspris
    //------------------------------------------------------
    Window_ShopSell.prototype.drawItem = function (index) {
        var item = this._data[index];
        if (!item) return;
        var rect = this.itemRect(index);
        rect.width -= this.textPadding();
        var count = $gameParty.numItems(item);
        var price = Math.floor(item.price / 2);
        this.changePaintOpacity(this.isEnabled(item));
        this.drawIcon(item.iconIndex, rect.x, rect.y + 2);
        // Navn
        this.resetTextColor();
        this.drawText(item.name, rect.x + 36, rect.y, rect.width - 36 - 160);
        // Antall (x2 osv)
        this.changeTextColor(this.textColor(8));
        this.drawText('x' + count, rect.x + rect.width - 160, rect.y, 60, 'right');
        // Pris
        this.changeTextColor(this.systemColor());
        this.drawText(price + 'G', rect.x + rect.width - 70, rect.y, 70, 'right');
        this.changePaintOpacity(true);
        this.resetTextColor();
    };

    //------------------------------------------------------
    // Window_ShopBuy – ikon + navn + pris (navn kun i lista, detaljer i infoboks)
    //------------------------------------------------------
    Window_ShopBuy.prototype.drawItem = function (index) {
        var item  = this._data[index];
        if (!item) return;
        var price = this.price(item);
        var rect  = this.itemRect(index);
        rect.width -= this.textPadding();
        this.changePaintOpacity(this.isEnabled(item));
        this.drawIcon(item.iconIndex, rect.x, rect.y + 2);
        this.drawText(item.name, rect.x + 36, rect.y, rect.width - 36 - 72);
        this.changeTextColor(this.systemColor());
        this.drawText(price + 'G', rect.x + rect.width - 70, rect.y, 70, 'right');
        this.changePaintOpacity(true);
        this.resetTextColor();
    };

})();