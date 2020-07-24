import { Control } from "../control.js";
import { UtilDOM } from "../utildom.js";
import { CustomActions, CustomAction, CustomActionParameter, CustomActionParameters } from "./customactions.js";
import { EventBus } from "../eventbus.js";
import { ControlDevices } from "../device/controldevice.js";

export class ControlCustomActions extends Control {  
    /**
     * 
     * @param {CustomActions} customActions 
     */ 
    constructor(customActions,args = {devices}){
        super();
        this.customActions = customActions;
        this.args = args;
    }
    getHtml(){
        return `
        <div class="customactionsroot">
            <div class="customactions">
            </div>
            <div class="customactionsbottom">
                <div class="button customactionaddbutton">Add New Action</div>
            </div>
        </div>
        `
    }
    getStyle(){
        return `
        .customactionsroot{
            display: flex;
            flex-direction: column;
        }
        .customactions{
            display: flex;
            flex-wrap: wrap;
        }
        .customactionsbottom{
            width: 100%;
        }
        .customactionsbottom > .button{
            width: 100%;
        }
        `
    }
    async renderSpecific({root}){
        this.customActionsElement = await this.$(".customactions");
        this.buttonAddElement = await this.$(".customactionaddbutton");

        this.buttonAddElement.onclick = async () => {
            const control = await this.addControlCustomAction(new CustomAction({id:Util.uuid}));
            control.announceChange();
        }
        this.customActionsElement.innerHTML = "";
        for(const customAction of this.customActions){
            await this.addControlCustomAction(customAction);
        }
    }
    /**
     * 
     * @param {CustomAction} customAction 
     */
    async addControlCustomAction(customAction){
        if(!this.controlsCustomAction){
            this.controlsCustomAction = [];
        }
        const control = new ControlCustomAction(customAction,this.args);
        this.controlsCustomAction.push(control);
        const render = await control.render();
        this.customActionsElement.appendChild(render);
        return control;
    }
    getCurrentSelectedDeviceIds(actionId){
        const controlCustomAction = this.controlsCustomAction.find(controlCustomAction => controlCustomAction.customAction.id == actionId);
        if(!controlCustomAction) return [];

        return controlCustomAction.currentSelectedDeviceIds;
    }
}
export class ControlCustomAction extends Control {  
    /**
     * 
     * @param {CustomAction} customAction
     */ 
    constructor(customAction,{devices}){
        super();
        this.customAction = customAction;
        this.devices = devices;
    }
    getHtml(){
        return `
        <div class="customaction">
            <div class="customactiontop"> 
                <div class="customactionicon"><img src="./images/join.png"/></div>               
                <div class="materialinput">      
                    <input type="text" class="customactionname" required >
                    <span class="highlight"></span>
                    <span class="bar"></span>
                    <label>Name</label>
                </div>
                <svg class="customactiondelete delete" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"></path></svg>
            </div>                           
            <div class="materialinput customactioninput">      
                <input type="text" class="customactionlongname" required >
                <span class="highlight"></span>
                <span class="bar"></span>
                <label>Long Name (Optional)</label>
            </div>                           
            <div class="materialinput customactioninput">      
                <input type="text" class="customactioncommand" required >
                <span class="highlight"></span>
                <span class="bar"></span>
                <label>Command</label>
            </div>
            <div class="customactionparameters"></div>
            <div class="customactiondevices"></div>
            <div class="customactionoptions">
                <div class="optioncommandline">
                    <input type="checkbox" name="commandline" >
                    <label for="commandline">Run in Command Line</label>                        
                    <div class="materialinput customactioninput">      
                        <input type="text" class="commandlineresponse" required >
                        <span class="highlight"></span>
                        <span class="bar"></span>
                        <label>Respose Command Prefix</label>
                    </div>
                </div>
            </div>
        </div>
        `
    }
    getStyle(){
        return `
        .customaction{
            display:flex;
            flex-grow: 1;
            width: 40%;
            flex-direction: column;
            padding: 20px;
            border: var(--theme-accent-color);
            border-width: thin;
            border-style: solid;
            border-radius: 10px;
            margin: 4px;
            margin-bottom: 8px;
        }
        .customactiontop{
            display: flex;
            align-items: flex-end;
        }
        .customactionicon{
            height: 40px;
            width: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .customactionicon > *{
            height: 40px;
            cursor: pointer;
            width: 40px;
        }
        .customactionicon > img{            
            object-fit: cover;
        }
        .customaction svg{
            fill: var(--theme-accent-color-lowlight);
        }
        .customactioninput{
            margin-top: 20px;
        }
        `
    }
    async announceChange(){
        await EventBus.post(new CustomActionChanged(this.customAction));
    }
    setInputChangeListener(element,customActionChanger){
        element.onkeyup = async () => {
            customActionChanger(this.customAction, element.value);
            await this.announceChange();
        }
    }
    get selectedDevices(){
        const ids = this.currentSelectedDeviceIds;
        if(ids.length == 0) return [];

        return this.devices.filter(device=>ids.includes(device.deviceId))
    }
    async renderSpecific({root}){
        this.customActionElement = root;

        this.nameElement = await this.$(".customactionname");
        this.longNameElement = await this.$(".customactionlongname");
        this.commandElement = await this.$(".customactioncommand");
        this.iconElement = await this.$(".customactionicon");
        this.devicesElement = await this.$(".customactiondevices");
        this.parametersElement = await this.$(".customactionparameters");
        this.deleteElement = await this.$(".customactiondelete");
        this.optionCommandLineElement = await this.$(".optioncommandline");
        this.commandLineElement = await this.$("[name=commandline]");
        this.commandLineResponseElement = await this.$(".commandlineresponse");

        this.nameElement.value = this.customAction.name || "";
        this.longNameElement.value = this.customAction.longName || "";
        this.commandElement.value = this.customAction.command || "";
        this.commandLineResponseElement.value = this.customAction.commandResponse || "";
        this.iconElement.innerHTML = await UtilDOM.getUsableImgOrSvgElementSrc({src:this.customAction.icon,defaultImage:"./images/join.png"});
        this.setInputChangeListener(this.nameElement,(customAction,value)=>customAction.name = value);
        this.setInputChangeListener(this.longNameElement,(customAction,value)=>customAction.longName = value);
        this.setInputChangeListener(this.commandElement,(customAction,value)=>customAction.command = value);
        this.setInputChangeListener(this.commandLineResponseElement,(customAction,value)=>customAction.commandResponse = value);
        this.commandLineElement.checked = this.customAction.commandLine;
        this.commandLineElement.onchange  = async () => {
            this.customAction.commandLine = this.commandLineElement.checked;
            await this.announceChange();
        }

        this.iconElement.onclick = async () => {
            const {ControlDialogInput} = await import("../dialog/controldialog.js")
            let src = await ControlDialogInput.showAndWait({title:"Select an icon for the action",placeholder:"http image or &lt;svg&gt; element"});
            if(!src) return;

            src = await UtilDOM.getUsableImgOrSvgElementSrc({src,convertToData:true});
            this.customAction.icon = src;
            this.iconElement.innerHTML = src;
            await this.announceChange();
        }
        this.deleteElement.onclick = async () => {
            await EventBus.post(new CustomActionDeleted(this.customAction));
        }
        
        this.controlDevices = new ControlDevices({controlId:this.customAction.id,devices:this.devices,selectedIdOrIds:this.customAction.deviceIds || []});
        this.devicesElement.innerHTML = "";
        this.devicesElement.appendChild(await this.controlDevices.render());
        
        this.controlParameters = new ControlCustomActionParameters(this.customAction);
        this.parametersElement.innerHTML = "";
        this.parametersElement.appendChild(await this.controlParameters.render());

        UtilDOM.showOrHide(this.optionCommandLineElement,this.selectedDevices.length > 0 && this.selectedDevices.every(device=>device.isBrowser));
    }
    get currentSelectedDeviceIds(){
        if(!this.controlDevices) return [];

        return this.controlDevices.currentSelectedDeviceIds;
    }
}
export class ControlCustomActionParameters extends Control {  
    /**
     * 
     * @param {CustomAction} customAction
     */ 
    constructor(customAction){
        super();
        this.customAction = customAction;
    }
    getHtml(){
        return `
            <div class="customactionparameterslistwrapper">  
                <div class="customactionparameterslist"></div>        
            </div>
        `
    }
    getStyle(){
        return `
            .customactionparameterslistwrapper{
                width: 100%;
                display: flex;
                flex-direction: column;
            }
            .customactionparameterslist{
                width: 100%;
                display: flex;
                flex-direction: column;
            }
            .customactionparameterslistwrapper > .button{
                width: 100%;
            }
        `
    }
    async renderSpecific({root}){
        this.parametersWrapperElement = root;
        this.parametersElement = await this.$(".customactionparameterslist");
        // this.buttonAddElement = await this.$(".customactionaddparameterbutton");

        if(this.customAction.parameters.length == 0){
            this.customAction.parameters.push(new CustomActionParameter({}));
        }
        const lastExisting = this.customAction.parameters.slice(-1)[0];
        if(lastExisting.text){
            this.customAction.parameters.push(new CustomActionParameter({}));
        }
        this.controlsCustomActionParameter = await this.renderList(this.parametersElement,this.customAction.parameters,ControlCustomActionParameter,null,{customAction:this.customAction,controlCustomActionParameters:this});
        // this.buttonAddElement.onclick = async () => {
        //     this.customAction.parameters.push(new CustomActionParameter({}));
        //     await EventBus.post(new CustomActionChanged(this.customAction));
        //     await this.render();  
        // }
    }
    async updateParameterList(controlCustomActionParameter){
        const value = controlCustomActionParameter.textElement.value;
        if(value){
            const lastExisting = this.customAction.parameters.slice(-1)[0];
            if(lastExisting && !lastExisting.text) return;

            const newParameter = new CustomActionParameter({});
            this.customAction.parameters.push(newParameter);
            const newEmpty = new ControlCustomActionParameter(newParameter,{customAction:this.customAction,controlCustomActionParameters:this});
            const render = await newEmpty.render();
            this.parametersElement.appendChild(render);
        }else{
            // await controlCustomActionParameter.dispose();
            // Util.removeIf(this.controlsCustomActionParameter,parameter=>!parameter.textElement.value);
            Util.removeIf(this.customAction.parameters,parameter=>!parameter.text);
            // if(this.controlsCustomActionParameter.length == 0){
                await this.render();
            // }
            this.parametersElement.lastElementChild.querySelector("input").focus()
        }        
    }
}

export class ControlCustomActionParameter extends Control {  
    /**
     * 
     * @param {CustomActionParameter} customActionParameter
     */ 
    constructor(customActionParameter,{customAction,controlCustomActionParameters}){
        super();
        this.customActionParameter = customActionParameter;
        this.customAction = customAction;
        this.controlCustomActionParameters = controlCustomActionParameters;
    }
    getHtml(){
        return `
            <div class="customactionparameter">                                     
                <div class="materialinput customactioninput customactionparameter">      
                    <input type="text" class="customactionparameterinput" required >
                    <span class="highlight"></span>
                    <span class="bar"></span>
                    <label>Prompt: set to send input as command parameter</label>
                </div>
            </div>
        `
    }
    getStyle(){
        return `
            .customactionparameter{
                display: flex;                
                flex-direction: column;
            }
        `
    }
    async announceChange(){
        await EventBus.post(new CustomActionChanged(this.customAction));
    }
    setInputChangeListener(element,customActionChanger){
        element.onkeyup = async e => {
            if(e.key == "Tab") return;
            await customActionChanger(this.customActionParameter, element.value);
            await this.announceChange();
        }
    }
    async renderSpecific({root}){
        this.parameterElement = root;

        this.textElement = await this.$(".customactionparameterinput");
        this.deleteElement = await this.$(".delete");
        this.textElement.value = this.customActionParameter.text || "";

        this.setInputChangeListener(this.textElement,async (parameter,value)=>{
            parameter.text = value;
            await this.controlCustomActionParameters.updateParameterList(this);
        });

    }
}
class CustomActionChanged{
    constructor(customAction){
        this.customAction = customAction;
    }
}
class CustomActionDeleted{
    constructor(customAction){
        this.customAction = customAction;
    }
}