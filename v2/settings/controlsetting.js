import { Control } from "../control.js";
import { SettingTextInput, SettingSingleOption, SettingColor, SettingKeyboardShortcut, SettingMultipleDevices, SettingCustomActions, SettingClipboardSync, SettingBoolean, SettingSecondaryColor } from "./setting.js";
import { UtilDOM } from "../utildom.js";
import { EventBus } from "../eventbus.js";

export class ControlSettings extends Control{
    constructor(settings){
        super();
        this.settings = settings;
    }
    getHtmlFile(){
        return "./v2/settings/settings.html";
    }
    getStyleFile(){
        return "./v2/settings/settings.css";
    }
   
    async renderSpecific({root}){
        this.settingsElement = await this.$(".settings");
        
        this.settingsElement.innerHTML = "";
        this.controlsSettings = [];
        for(const setting of this.settings){
            const controlSetting = new ControlSetting(setting);
            this.controlsSettings.push(controlSetting);
            const render = await controlSetting.render();
            this.settingsElement.appendChild(render);
        }       
    }
    async update(setting){
        this.controlsSettings.forEach(async controlSetting=>{
            UtilDOM.showOrHide(controlSetting,await controlSetting.setting.isApplicable);
        })
        const controlSetting = this.controlsSettings.find(controlSetting=>controlSetting.setting.id == setting.id);
        if(!controlSetting) return;

        await controlSetting.render();
    }
    async getSetting(id){
        for(const controlSetting of this.controlsSettings){
            const result = await controlSetting.matches(id);
            if(result) return controlSetting;
        }
        return null;
    }
    async unload(){
        for(const controlSetting of this.controlsSettings){
            await controlSetting.unload();
        }
    }
}
export class ControlSetting extends Control{
    /**
     * 
     * @param {Setting} setting 
     */
    constructor(setting){
        super()
        this.setting = setting;
    }
    async matches(id){
        if(this.content.matches) return  this.content.matches(id);

        return this.setting.id == id;
    }
    getHtmlFile(){
        return "./v2/settings/setting.html";
    }
    getStyleFile(){
        return "./v2/settings/setting.css";
    }
   
    async renderSpecific({root}){
        this.settingElement = root;
        this.settingLabelElement = await this.$(".settinglabel");
        this.settingSubtextElement = await this.$(".settingsubtext");
        this.settingExtratextElement = await this.$(".settingextratext");
        this.settingSetNotSetElement = await this.$(".settingsetnotsettext");
        this.settingSetElement = await this.$(".settingset");
        this.settingNotSetElement = await this.$(".settingnotset");
        this.settingContentElement = await this.$(".settingcontent");
       
        this.settingLabelElement.innerHTML = this.setting.label;

        UtilDOM.showOrHide(this.settingSubtextElement,this.setting.subtext);
        this.settingSubtextElement.innerHTML = this.setting.subtext;
        
        UtilDOM.showOrHide(this.settingExtratextElement,this.setting.extratext);
        this.settingExtratextElement.innerHTML = this.setting.extratext;
        
        UtilDOM.showOrHide(this.settingSetNotSetElement,this.setting.isSecret);
        const value = await this.setting.value;
        UtilDOM.showOrHide(this.settingSetElement,value);
        UtilDOM.showOrHide(this.settingNotSetElement,!value);
        

        this.settingContentElement.innerHTML = "";
        this.content = await ControlSetting.getControlSettingContent(this.setting);
        const render = await this.content.render();
        this.settingContentElement.appendChild(render);
        
    }
    static async getControlSettingContent(setting){
        if(Util.isSubTypeOf(setting,SettingTextInput)){
            return new ControlSettingContentTextInput(setting);
        }
        if(Util.isSubTypeOf(setting,SettingSingleOption)){
            return new ControlSettingContentSingleOption(setting);
        }
        if(Util.isSubTypeOf(setting,SettingBoolean)){
            return new ControlSettingContentColorBoolean(setting);
        }
        if(Util.isSubTypeOf(setting,SettingColor)||Util.isSubTypeOf(setting,SettingSecondaryColor)){
            return new ControlSettingContentColor(setting);
        }
        if(Util.isSubTypeOf(setting,SettingKeyboardShortcut)){
            return new ControlSettingKeyboardShortcut(setting);
        }
        if(Util.isSubTypeOf(setting,SettingMultipleDevices)){
            return new ControlSettingMultipleDevices(setting);
        }
        if(Util.isType(setting,"SettingCustomActions")){
            return new ControlSettingCustomActions(setting);
        }
        let type = Util.getType(setting);
        const typeFromSetting = (await import("./setting.js"))[type].controlType;
        if(typeFromSetting){
            type = typeFromSetting;
        }else{
            type = type.replace("Setting","SettingContent");
            type = `Control${type}`;
        }
        const controlType = eval(type);
        return new controlType(setting);
    }
    // async unload(){
    //     await super.unload();
        
    //     await this.content.unload()
    // }
}
export class ControlSettingContent extends Control{
    
    constructor(setting){
        super()
        this.setting = setting;
    }
}
export class ControlSettingContentTextInput extends ControlSettingContent{
    /**
     * 
     * @param {SettingTextInput} setting
     */
    constructor(setting){
        super(setting)
    }
    getHtmlFile(){
        return "./v2/settings/settingtextinput.html";
    }
    getStyleFile(){
        return "./v2/settings/settingtextinput.css";
    }
   
    async renderSpecific({root}){
        this.settingElement = root;   

        this.placeholderElement = await this.$("label");
        this.inputElement = await this.$("input");
        this.saveButtonElement = await this.$(".save");
        this.resetButtonElement = await this.$(".reset");
        
        UtilDOM.enable(this.saveButtonElement);
        UtilDOM.enable(this.inputElement);
        UtilDOM.enable(this.resetButtonElement);

        UtilDOM.showOrHide(this.resetButtonElement,this.setting.isSecret)
        
        this.placeholderElement.innerHTML = this.setting.placeholder;
        const value = await this.setting.value;
        if(!this.setting.isSecret && value){
            this.inputElement.value = value;
        }else{
            this.inputElement.value = "";
        }
        this.saveButtonElement.onclick = async () => {
            const settingSaved = new SettingSaved(this.setting,this.inputElement.value);
            this.inputElement.value = "";
            this.placeholderElement.innerHTML = "Saving. May take a while...";
            UtilDOM.disable(this.saveButtonElement);
            UtilDOM.disable(this.resetButtonElement);
            UtilDOM.disable(this.inputElement);
            await EventBus.post(settingSaved)
            if(this.setting.isSecret){
                this.placeholderElement.innerHTML = this.setting.placeholder;
                UtilDOM.enable(this.saveButtonElement);
                UtilDOM.enable(this.resetButtonElement);
                UtilDOM.enable(this.inputElement);
            }
        }
        this.resetButtonElement.onclick = async () => await EventBus.post(new SettingSaved(this.setting,null));
    }
}
export class ControlSettingContentSingleOption extends ControlSettingContent{
    /**
     * 
     * @param {SettingSingleOption} setting
     */
    constructor(setting){
        super(setting)
    }
    getHtmlFile(){
        return "./v2/settings/settingsingleoption.html";
    }
    getStyleFile(){
        return "./v2/settings/settingsingleoption.css";
    }
   
    async renderSpecific({root}){
        this.settingElement = root;   

        this.selectElement = await this.$("select");
        this.renderList(this.selectElement,this.setting.options,option=>{
            const optionElement = document.createElement("option");
            optionElement.value = option.id;
            optionElement.innerHTML = option.label;
            return optionElement;
        })
        this.selectElement.value = await this.setting.value;
        this.selectElement.onchange = async () => await EventBus.post(new SettingSaved(this.setting,this.selectElement.value));
    }
}
export class ControlSettingContentColor extends ControlSettingContent{
    /**
     * 
     * @param {SettingSingleOption} setting
     */
    constructor(setting){
        super(setting)
    }
    getHtml(){
        return `
            <div class="colorsettingroot">
                <input type="color"></input>
                <div class="button reset">Reset</div>
            </div>
        `
    }
    getStyle(){
        return `
            .colorsettingroot{
                display: flex;
            }
        `
    }
   
    async renderSpecific({root}){
        this.settingElement = await this.$("input[type=color]"); 
        this.resetElement = await this.$(".reset"); 

        this.settingElement.value = await this.setting.value;
        this.settingElement.onchange = async () => await EventBus.post(new SettingSaved(this.setting,this.settingElement.value));
        this.resetElement.onclick = async () => await EventBus.post(new SettingSaved(this.setting,null));
    }
}
export class ControlSettingContentColorBoolean extends ControlSettingContent{
    /**
     * 
     * @param {SettingBoolean} setting
     */
    constructor(setting){
        super(setting)
    }
    getHtml(){
        return `
            <div class="settingboolean">
                <input type="checkbox" name="check" />
                <label for="check"></label>
            </div>
        `
    }
   
    async renderSpecific({root}){
        this.settingElement = root;  
        this.valueElement = await this.$("input"); 
        this.labelElement = await this.$("label"); 

        this.labelElement.innerHTML = this.setting.label;
        this.valueElement.checked = await this.setting.value;
        this.settingElement.onchange = async () => await EventBus.post(new SettingSaved(this.setting,this.valueElement.checked));
    }
}
export class ControlSettingKeyboardShortcut extends ControlSettingContent{
    /**
     * 
     * @param {SettingKeyboardShortcut} setting
     */
    constructor(setting){
        super(setting)
    }
    getHtml(){
        return `
        <div class="settingkeyboardshortcut">
            <div class="settingkeyboardshortcutvalue"></div>
            <div>
                <div class="settingkeyboardshortcutset button">Set</div>
                <div class="settingkeyboardshortcutdelete button">Delete</div>
            </div>
        </div>
        `
    }
    getStyle(){
        return `
            .settingkeyboardshortcut{
                display:flex;
                flex-direction:column;
            }
            .settingkeyboardshortcut> *{
                padding: 8px;
            }
            .settingkeyboardshortcutvalue{
                color: var(--theme-accent-color-lowlight);
            }
            .settingkeyboardshortcutvalue.valueset{
                font-weight:bold;
                color: var(--theme-text-color);
                background-color:var(--theme-background-color-panel)
            }
        `
    }
   
    async renderSpecific({root}){
        this.settingElement = root;   
        this.valueElement = await this.$(".settingkeyboardshortcutvalue");
        this.setElement = await this.$(".settingkeyboardshortcutset");
        this.deleteElement = await this.$(".settingkeyboardshortcutdelete");

        const value = await this.setting.value;
        UtilDOM.addOrRemoveClass(this.valueElement,value?true:false,"valueset");
        this.valueElement.innerHTML =  value || "Not Set";
        this.setElement.onclick = async () => {
            await EventBus.post(new SettingSaved(this.setting,"prompt"));
        }
        this.deleteElement.onclick = async () => {
            await EventBus.post(new SettingSaved(this.setting,null));
        }
    }
}
export class ControlSettingMultipleDevices extends ControlSettingContent{
    /**
     * 
     * @param {SettingMultipleDevices} setting
     */
    constructor(setting){
        super(setting)
    }
    getHtml(){
        return `
        <div class="settingdevices">
        </div>
        `
    }
    getStyle(){
        return `
           
        `
    }
   
    async renderSpecific({root}){
        this.settingElement = root;
        
        this.settingElement.innerHTML = "";
        const {ControlDevices} = await import("../device/controldevice.js");
        const selectedIds = await this.setting.value;
        this.controlDevices = new ControlDevices({controlId:SettingClipboardSync.id,devices:this.setting.devices,selectedIdOrIds:selectedIds});
        const devicesElement = await this.controlDevices.render();
        this.settingElement.appendChild(devicesElement);
    }
    getCurrentSelectedDeviceIds(){
        return this.controlDevices.currentSelectedDeviceIds;
    }
}
export class ControlSettingCustomActions extends ControlSettingContent{
    /**
     * 
     * @param {SettingCustomActions} setting
     */
    constructor(setting){
        super(setting)
        EventBus.register(this);
        this.onCustomActionChanged = Util.debounce(async ({customAction})=>{
            await this.setting.updateCustomAction(customAction);
        },1000)
    }
    getHtml(){
        return `
        <div class="settingcustomactions">
        </div>
        `
    }
    getStyle(){
        return `
           
        `
    }
   
    async onCustomActionDeleted({customAction}){
        await this.setting.deleteCustomAction(customAction);
        await this.render();
    }
    async matches(id){
        const customActions = await this.setting.value;
        const customAction = customActions.getCustomAction(id);
        return customAction ? true : false;
    }
    async renderSpecific({root}){
        this.settingElement = root;
        
        this.settingElement.innerHTML = "";
        const {ControlCustomActions} = await import("../customactions/controlcustomactions.js");
        const customActions = await this.setting.value;
        this.controlCustomActions = new ControlCustomActions(customActions,{devices:this.setting.devices});
        const render = await this.controlCustomActions.render();
        this.settingElement.appendChild(render);
    }
    getCurrentSelectedDeviceIds(settingId){
        return this.controlCustomActions.getCurrentSelectedDeviceIds(settingId);
    }
}
class SettingSaved{
    constructor(setting,value){
        this.setting = setting;
        this.value = value;
    }
}