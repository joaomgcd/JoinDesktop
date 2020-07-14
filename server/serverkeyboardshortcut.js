import { KeyboardShortcut } from '../v2/keyboard/keyboardshortcut.js';
import { EventBus } from '../v2/eventbus.js';

const { globalShortcut } = require('electron')
const Store = require('./store.js');
const store = new Store({
    configName: 'shortcuts',
    defaults: []
});

export class ServerKeyboardShortcuts{
    static async storeShortcuts(shortcuts){
        await ServerKeyboardShortcuts.clearShortcuts();
        for(const shortcut of shortcuts){
            await ServerKeyboardShortcuts.storeShortcut(shortcut)
        }
    }
    static async clearShortcuts(){
        console.log("Cleared shortcuts");
        store.setData([]);
    }
    static async storeShortcut(shortcut){
        console.log("Storing shortcut", shortcut);
        const shortcuts = await ServerKeyboardShortcuts.configured;
        const toInsert = new KeyboardShortcut(shortcut);
        const existingIndex = shortcuts.findIndex(shortcut => new KeyboardShortcut(shortcut).toString() == toInsert.toString())
        if(existingIndex >= 0){
            shortcuts.splice(existingIndex,1);
        }
        shortcuts.push(toInsert);
        
        store.setData(shortcuts);

        await ServerKeyboardShortcuts.setGlobalShortcutsFromStored();

        
    }
    static async setGlobalShortcutsFromStored(){
        const shortcuts = await ServerKeyboardShortcuts.configured;
        globalShortcut.unregisterAll()

        shortcuts.forEach(shortcut=>{
            shortcut = new KeyboardShortcut(shortcut);

            let shortcutText = shortcut.keyName;
            if(shortcut.hasControl){
                shortcutText = `Control+${shortcutText}`;
            }
            if(shortcut.hasShift){
                shortcutText = `Shift+${shortcutText}`;
            }
            if(shortcut.hasAlt){
                shortcutText = `Alt+${shortcutText}`;
            }
            console.log("Registering shortcut",shortcutText);
            globalShortcut.register(shortcutText, async () => {
                await EventBus.post(new ShortcutPressed(shortcut));
                console.log("Shortcut pressed",shortcutText,shortcut)
            })
        })
    }
    static get configured(){
        return (async () => {
            let data = store.getData();
            if(!data){
                data = [];
            }
            return data;
        })(); 
    }
}
class ShortcutPressed{
    constructor(shortcut){
        this.shortcut = shortcut;
    }
}