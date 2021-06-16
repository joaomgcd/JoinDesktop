import { AppContext } from "../appcontext.js";
import { CustomActions } from "../customactions/customactions.js";
import { EventBus } from "../eventbus.js";

export class Settings extends Array{
    constructor(initial){
        if(Number.isInteger(initial)){
            super(initial);
			return;
        }
        super();
    }
}
const getSettingsdDb = () => {
    const db = new Dexie("join_settings");
    db.version(1).stores({
        settings: 'id,value'
    });
    return db.settings;
}
export class Setting{
    constructor(args = {id,label,subtext,extratext}){
        Object.assign(this,args)
    }
    get value(){
        if(this.isDbSetting){
            return (async ()=>{
                const db = getSettingsdDb();
                const item = await db.get(this.id);
                if(!item) return null;

                return item.value;
            })();
        }
        return AppContext.context.localStorage.get(this.id);
    }
    set value(val){
        if(this.isDbSetting){
            const db = getSettingsdDb();
            db.put({id:this.id,value:val});
            return;
        }
        AppContext.context.localStorage.set(this.id,val);
    }
    get isDbSetting(){
        return false;
    }
    get isApplicable(){
        return true;
    }
}
export class SettingTextInput extends Setting{
    constructor(args = {placeholder,isSecret}){
        super(args)
    }
}
export class SettingEncryptionPassword extends SettingTextInput{
    static get id(){
        return "settingencryptionpassword";
    }
    get value(){
        return Encryption.encryptionPassword;
    }
    set value(val){
        Encryption.encryptionPassword = val
    }
    constructor(){
        super({
            id:SettingEncryptionPassword.id,
            label:"Encrypt Communication",
            placeholder:"Password",
            subtext:"If set, the password will encrypt your pushes before they are sent other devices. The same password must be set on receiving devices.",
            isSecret: true
        })
    }
}
export class SettingCompanionAppPortToConnect extends SettingTextInput{
    static get id(){
        return "SettingCompanionAppPortToConnect";
    }
    get isDbSetting(){
        return true;
    }
    constructor(){
        super({
            id:SettingCompanionAppPortToConnect.id,
            label:"Join Desktop Port",
            placeholder:"Port",
            subtext:`
            <div>Use the Join Desktop app if you want a more fully featured experience, like support for clipboard sync, global keyboard shortcuts and command line actions.</div>
            <div>Learn more about the desktop app and what it can do <a target="_blank" href="https://joaoapps.com/join/desktop/">here</a>.</div>
            `
        })
    }
}
export class SettingCompanionAppPortToReceive extends SettingTextInput{
    static get id(){
        return "SettingCompanionAppPortToReceive";
    }
    constructor(){
        super({
            id:SettingCompanionAppPortToReceive.id,
            label:"Companion App Port To Receive",
            placeholder:"Port",
            subtext:`
            <div>Set the port on which to receive requests from the web app.</div>
            <div>Make sure that this port matches the port set in the <a id="linkopenwebapp">web app</a>.</div>
            `
        })
    }
}
export class SettingEventGhostNodeRedPort extends SettingTextInput{
    static get id(){
        return "SettingEventGhostNodeRedPort";
    }
    get isDbSetting(){
        return true;
    }
    constructor(){
        super({
            id:SettingEventGhostNodeRedPort.id,
            label:"EventGhost, Node-RED",
            placeholder:"Port",
            subtext:`If set, will redirect received Commands to the specified port (<a target="_blank" href="https://joaoapps.com/autoremote/eventghost/">AutoRemote plugin in EventGhost</a> or <a  target="_blank" href="https://joaoapps.com/join/node-red/">Join plugin in Node-RED</a>)`
        })
    }
}
class SettingIntInput extends SettingTextInput{    
    get value(){
        return (async ()=>{
            let value = await super.value;
            value = parseInt(value);
            return value ? value : null;
        })()
    }
    set value(v){
        super.value = v
    }
}
export class SettingNotificationTimeout extends SettingIntInput{
    static get id(){
        return "SettingNotificationTimeout";
    }
    get isDbSetting(){
        return true;
    }
    constructor(){
        super({
            id:SettingNotificationTimeout.id,
            label:"Notification Timeout",
            placeholder:"Time in Seconds",
            subtext:`If set, will make all non-native notifications disappear automatically after these seconds. They will still be available in the notifications screen in the main app.`
        })
    }
    get isApplicable(){
        return new SettingUseNativeNotifications().value.then(value=>!value);
    }
}
export class SettingAutomationPortFullPush extends SettingTextInput{
    static get id(){
        return "SettingAutomationPortFullPush";
    }
    get isDbSetting(){
        return true;
    }
    constructor(){
        super({
            id:SettingAutomationPortFullPush.id,
            label:"Full Push"
        })
    }
}
export class SettingBoolean extends Setting{
    constructor(args = {placeholder,isSecret}){
        super(args)
    }
}
export class SettingUseNativeNotifications extends SettingBoolean{  
    static get id(){
        return "SettingUseNativeNotifications";
    } 
    constructor(){
        super({
            id:SettingUseNativeNotifications.id,
            label:"Use Native Notifications",
            subtext:`If set, will use your OS' native notification system which is more restricted than Join's internal one.`
        })
    }
    get isDbSetting(){
        return false;
    }
    get value(){
        return (async ()=>{
            const value = await super.value;
            return value == true || value == "true";
        })()
    }
    set value(v){
        super.value = v
        EventBus.post(new RequestRefreshSettings());
    }
}
export class SettingRequireEncryptionForCommandLine extends SettingBoolean{  
    static get id(){
        return "SettingRequireEncryptionForCommandLine";
    } 
    constructor(){
        super({
            id:SettingRequireEncryptionForCommandLine.id,
            label:"Require Encryption For Command Line",
            subtext:`If set, will require incoming pushes to be encrypted to be able to run command line commands`
        })
    }
}
export class SettingSingleOption extends Setting{
    //options is {id,label}
    constructor(args = {options}){
        super(args)
    }
}
export class SettingTheme extends SettingSingleOption{
    static get id(){
        return "settingtheme";
    }
    static get themeIdAuto(){
        return "auto"
    }
    static get themeIdAutoDarker(){
        return "autodarker"
    }
    static get themeIdAutoBlack(){
        return "autoblack"
    }
    static get themeIdLight(){
        return "light"
    }
    static get themeIdDark(){
        return "dark"
    }
    static get themeIdDarker(){
        return "darker"
    }
    static get themeIdBlack(){
        return "black"
    }
    get value(){
        return super.value || SettingTheme.themeIdAuto;
    }
    set value(val){
        super.value = val
    }
    static get themeOptions(){
        return [
            {
                id:SettingTheme.themeIdAuto,
                label:"Auto (Dark)",
                light:SettingTheme.themeIdLight,
                dark:SettingTheme.themeIdDark
            },
            {
                id:SettingTheme.themeIdAutoDarker,
                label:"Auto (Darker)",
                light:SettingTheme.themeIdLight,
                dark:SettingTheme.themeIdDarker
            },
            {
                id:SettingTheme.themeIdAutoBlack,
                label:"Auto (Black)",
                light:SettingTheme.themeIdLight,
                dark:SettingTheme.themeIdBlack
            },
            {
                id:SettingTheme.themeIdLight,
                label:"Light",
                backgroundColor: "#FFFFFF",
                backgroundColorPanel:"#F0F0F0",
                accentColorLowlight:"#757575"
            },
            {
                id:SettingTheme.themeIdDark,
                label:"Dark",
                backgroundColor:"#37474F",
                backgroundColorPanel:"#78909C",
                backgroundHover:"#455A64",
                textColor:"#FFFFFF",
                accentColorLowlight:"#FFFFFF"
            },
            {
                id:SettingTheme.themeIdDarker,
                label:"Darker",
                backgroundColor:"#2f3a40",
                backgroundColorPanel:"#505659",
                backgroundHover:"#223a45",
                textColor:"#FFFFFF",
                accentColorLowlight:"#FFFFFF"
            },
            {
                id:SettingTheme.themeIdBlack,
                label:"Black",
                backgroundColor:"#000000",
                backgroundColorPanel:"#000000",
                backgroundHover:"#000000",
                textColor:"#FFFFFF",
                accentColorLowlight:"#FFFFFF"
            }
        ]
    }
    static getThemeOption(themeId){
        let selected = SettingTheme.themeOptions.find(option=>option.id == themeId);
        if(selected.light && selected.dark){ 
            if(Util.darkModeEnabled){
                selected = SettingTheme.getThemeOption(selected.dark);
            }else{
                selected = SettingTheme.getThemeOption(selected.light);
            }
        }
        return selected;
    }
    get theme(){
        let selected = SettingTheme.getThemeOption(this.value);
        return selected;
    }
    constructor(){
        super({
            id:SettingTheme.id,
            label:"Theme",
            options:SettingTheme.themeOptions
        })
    }
}
export class SettingColor extends Setting{
    //options is {id,label}
    constructor(args){
        super(args)
    }
    static isThemeSetting(settingId){
        if(!settingId) return false;

        return settingId == SettingTheme.id
            ||  settingId == SettingThemeAccentColor.id
            ||  settingId.startsWith("SettingTheme");
    }
}
export class SettingThemeAccentColor extends SettingColor{
    static get id(){
        return "themeaccentcolor";
    }
    get value(){
        return super.value || "#FF9800";
    }
    set value(val){
        super.value = val
    }
    //options is {id,label}
    constructor(args){
        super({
            id:SettingThemeAccentColor.id,
            label:"Accent Color"
        })
    }
}
export class SettingSecondaryColor extends Setting{
    //abstract
    get themeProperty(){}
    
    get value(){
        const theme =  new SettingTheme().theme;
        return super.value || theme[this.themeProperty];
    }
    set value(val){
        super.value = val
    }
    constructor(args){
        super(args)
    }
}
export class SettingThemeBackgroundColor extends SettingSecondaryColor{
    static get id(){
        return "SettingThemeBackgroundColor";
    }
    get themeProperty(){
        return "backgroundColor";
    }
    //options is {id,label}
    constructor(args){
        super({
            id:SettingThemeBackgroundColor.id,
            label:"Background Color"
        })
    }
}
export class SettingThemeBackgroundPanelColor extends SettingSecondaryColor{
    static get id(){
        return "SettingThemeBackgroundPanelColor";
    }
    get themeProperty(){
        return "backgroundColorPanel";
    }
    //options is {id,label}
    constructor(args){
        super({
            id:SettingThemeBackgroundPanelColor.id,
            label:"Background Panel Color"
        })
    }
}
export class SettingThemeTextColor extends SettingSecondaryColor{
    static get id(){
        return "SettingThemeTextColor";
    }
    get themeProperty(){
        return "textColor";
    }
    //options is {id,label}
    constructor(args){
        super({
            id:SettingThemeTextColor.id,
            label:"Text Color"
        })
    }
}
export class SettingThemeTextColorOnAccent extends SettingColor{
    static get id(){
        return "SettingThemeTextColorOnAccent";
    }
    get themeProperty(){
        return "textColor";
    }
    get value(){
        return super.value || "#FFFFFF";
    }
    get storedValue(){
        return super.value;
    }
    set value(val){
        super.value = val
    }
    //options is {id,label}
    constructor(args){
        super({
            id:SettingThemeTextColorOnAccent.id,
            label:"Text Color on Accent"
        })
    }
}
export class SettingKeyboardShortcut extends Setting{
    constructor(args){
        super(args)
    }
    isDbSetting(){
        return true;
    }
    get commands(){        
        return import("../command/command.js");
    }
    get command(){
        return (async()=>{
            return new (await this.commands)[this.commandName]()
        })()
    }
    //abstract 
    get commandName(){}
}
export class SettingKeyboardShortcutLastCommand extends SettingKeyboardShortcut{
    static get id(){
        return "keyboardshortcutlastcommand";
    }
    get commandName(){
        return "CommandRepeatLastCommand";
    }
    constructor(args){
        super({
            id:SettingKeyboardShortcutLastCommand.id,
            label:"Repeat Last Command",
            subtext:"Keyboard shortcut To repeat the last used command on the devices screen"
        })
    }
}
export class SettingKeyboardShortcutShowWindow extends SettingKeyboardShortcut{
    static get id(){
        return "keyboardshortcutshowwindow";
    }
    get commandName(){
        return "CommandShowAppWindow";
    }
    constructor(args){
        super({
            id:SettingKeyboardShortcutShowWindow.id,
            label:"Show App",
            subtext:"Keyboard Shortcut To Show the App Window"
        })
    }
}
export class SettingKeyboardShortcutSkipSong extends SettingKeyboardShortcut{
    static get id(){
        return "SettingKeyboardShortcutSkipSong";
    }
    get commandName(){
        return "CommandSkipSong";
    }
    constructor(args){
        super({
            id:SettingKeyboardShortcutSkipSong.id,
            label:"Skip Song",
            subtext:"Keyboard Shortcut To Skip the Currently Playing Song"
        })
    }
}
export class SettingKeyboardShortcutPreviousSong extends SettingKeyboardShortcut{
    static get id(){
        return "SettingKeyboardShortcutPreviousSong";
    }
    get commandName(){
        return "CommandPreviousSong";
    }
    constructor(args){
        super({
            id:SettingKeyboardShortcutPreviousSong.id,
            label:"Previous Song",
            subtext:"Keyboard Shortcut To press the back button on the currently playing media app"
        })
    }
}
export class SettingKeyboardShortcutPlayPause extends SettingKeyboardShortcut{
    static get id(){
        return "SettingKeyboardShortcutPlayPause";
    }
    get commandName(){
        return "CommandPlayPause";
    }
    constructor(args){
        super({
            id:SettingKeyboardShortcutPlayPause.id,
            label:"Play/Pause",
            subtext:"Keyboard Shortcut To toggle playing on the currently playing media app"
        })
    }
}
export class SettingMultipleDevices extends Setting{
    constructor(args){
        super(args)
    }
}
export class SettingClipboardSync extends SettingMultipleDevices{
    static get id(){
        return "clipboardSync";
    }
    get value(){
        return (async () => {
            let stringValue = await super.value
            if(!stringValue) return [];

            return stringValue.split(",");
        })();
    }
    set value(toSet){
        super.value = toSet.join(",");
    }
    constructor(args = {devices}){
        super({
            id:SettingClipboardSync.id,
            label:"Automatically Send Clipboard To",
            devices: args.devices.filter(device=>device.canSyncClipboardTo())
        })
    }
    async updateSelectedDevices(settingId, selectedDeviceIds){
        this.value = selectedDeviceIds;
    }
}
export class SettingCustomActions extends Setting{
    static get id(){
        return "customActions";
    }
    /** @type {Promise<CustomActions>} */
    get value(){
        return (async () => {
            let stringValue = await super.value
            const {CustomActions} = await import("../customactions/customactions.js");
            if(!stringValue) return new CustomActions();

            const array = JSON.parse(stringValue);
            return new CustomActions(array);
        })();
    }
    get isDbSetting(){
        return true;
    }
    set value(toSet){
        super.value = JSON.stringify(toSet);
    }
    constructor(args = {devices,canRunCommandLineCommands:false}){
        super({
            id:SettingCustomActions.id,
            label:"Custom Actions",
            subtext: `<h4>These actions will show up in your device command list in the Join popup. Use Tasker (Android), EventGhost (Windows), Node-RED (Windows,Linux,Mac) or IFTTT (web) to react to them. More info <a href="https://joaoapps.com/join/actions/">here</a>.</h4>`,
            devices: args.devices,
            canRunCommandLineCommands: args.canRunCommandLineCommands
        })
    }
    async updateCustomAction(customAction){
        const customActions = await this.value;
        customActions.update(customAction)
        this.value = customActions;
        console.log("Saved custom actions",customActions)
    }
    async deleteCustomAction(customAction){
        const customActions = await this.value;
        customActions.delete(customAction)
        this.value = customActions;
        console.log("Deleted custom action",customAction)
    }
    async updateSelectedDevices(settingId, selectedDeviceIds){
        console.log("Updating deviceIds",settingId,selectedDeviceIds);

        const customActions = await this.value;
        const customAction = await customActions.getCustomAction(settingId);
        if(!customAction) return;

        customAction.deviceIds = selectedDeviceIds;
        this.value = customActions;
    }
}
class RequestRefreshSettings{}
