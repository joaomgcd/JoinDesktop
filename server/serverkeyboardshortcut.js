
const { globalShortcut } = require('electron')
const Store = require('./store.js');
const store = new Store({
    configName: 'shortcuts',
    defaults: []
});

export class ServerKeyboardShortcuts{
    static async clearShortcuts(){
        console.log("Cleared shortcuts");
        store.setData([]);
    }
    static async storeShortcut(configured = {shortcut,command}){
        console.log("Storing shortcut", configured);
        const shortcuts = await ServerKeyboardShortcuts.configured;
        shortcuts.push(configured);
        store.setData(shortcuts);

        console.log("Existing shortcuts",shortcuts);
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