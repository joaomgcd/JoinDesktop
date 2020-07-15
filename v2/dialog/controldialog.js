import { DialogSingleChoice,DialogInput, DialogProgress,DialogOk } from "./dialog.js";
import { Control } from "../control.js";
import { UtilDOM } from "../utildom.js";
import { EventBus } from "../eventbus.js";

export class ControlDialog extends Control {
    constructor({dialog}){
        super();
        this.dialog = dialog;
    }
    getDialogBackground(initIfNeeded){
        const backgroundId = "mycontroldialogsuperdimmedbackground";
        let background = document.body.querySelector(`#${backgroundId}`);
        if(background || !initIfNeeded) return background;
        
        background = document.createElement("div");
        background.id = backgroundId;
        background.style.position = "absolute";
        background.style["background-color"] = "rgba(0, 0, 0, 0.5)";
        background.style["z-index"] = "999999999999999";
        document.body.appendChild(background);

        return background;
    }
    async show(position = {x,y,isCenter},dimBackground = true){
        
        if(!position){
            const bodyBounds = UtilDOM.getElementBounds(document.body);
            position = {x:bodyBounds.right/2,y:bodyBounds.bottom/2,isCenter:true}
        }
        if(!position.x || !position.y){            
            try{
                const bounds = UtilDOM.getElementBounds(position);
                position = {x:bounds.left,y:bounds.top,isCenter:false};
            }catch{
                position = {isCenter:true};
            }
        }
        if(dimBackground){
            const background = this.getDialogBackground(true);
            const documentBounds = UtilDOM.getElementBounds(document.body);
            background.style.width = `${documentBounds.right}px`;
            background.style.height = `${documentBounds.bottom}px`;
            UtilDOM.show(background);
        }
        if(!this.rendered){
            this.rendered = await this.render();
            this.rendered.classList.add("dialog");
            this.rendered.style.left = `${position.x}px`;
            this.rendered.style.top = `${position.y}px`;
            UtilDOM.makeInvisible(this.rendered);
            document.body.appendChild(this.rendered);
            const dialogBounds = UtilDOM.getElementBounds(this.rendered);
            if(position.isCenter){
                const width = dialogBounds.right - dialogBounds.left;
                const height = dialogBounds.bottom - dialogBounds.top;
                const newLeft = position.x - (width/2);
                const newTop = position.y - (height/2);
                this.rendered.style.left = `${newLeft}px`;
                this.rendered.style.top = `${newTop}px`;
            }
            const bottomDocument = UtilDOM.getElementBounds(document.body).bottom;
            const bottomRendered = dialogBounds.bottom;
            if(bottomRendered > bottomDocument){
                const finalPositionY = position.y - (bottomRendered - bottomDocument) - 8;
                this.rendered.style.top = `${finalPositionY}px`;
            }
        }
        UtilDOM.show(this.rendered);
        this.onShown();
    }
    async dispose(){
        await super.dispose()        
        UtilDOM.hide(this.getDialogBackground(false));
    }
    //open
    onShown(){}
}
const showDialog = async ({args,dialogclass,controlclass}) => {
    args.dialog = new dialogclass(args);
    const control = new controlclass(args);
    if(!args.position){
        args.position = null;
    }
    control.show(args.position);
    return control;
}
const showDialogAndWait = async (showArgs = {args,dialogclass,controlclass,waitForClass,timeout}) => {
    if(!showArgs.timeout){
        if(showArgs.args && showArgs.args.timeout){
            showArgs.timeout = showArgs.args.timeout;
        }else{
            showArgs.timeout = 15000;
        }
    }
    const control = await showDialog(showArgs);
    try{
        console.log(`Showing dialog for ${showArgs.timeout / 1000} seconds`, showArgs.dialogclass.name);
        const result = await EventBus.waitFor(showArgs.waitForClass,showArgs.timeout);
        return result
    }catch(error){
        console.log("Didn't get choice from dialog",error);
        return null;
    }finally{
        await control.dispose();
    }
}
export class ControlDialogSingleChoice extends ControlDialog {
    static getDialogArgs(args){
        return {args,dialogclass:DialogSingleChoice,controlclass:ControlDialogSingleChoice,waitForClass:SingleChoiceChosen};
    }
    static async show(args = {position,choices,choiceToLabelFunc}){
        if(!args.choices || !args.choices.length || args.choices.length == 0) return;
        
        return showDialog(ControlDialogSingleChoice.getDialogArgs(args));        
    }
    static async showAndWait(args){       
        if(!args.choices || !args.choices.length || args.choices.length == 0) return;

        const result = (await showDialogAndWait(ControlDialogSingleChoice.getDialogArgs(args)));
        if(!result) return;
        
        return result.choice;
    }
    constructor(args = {dialog,choiceToLabelFunc}){
        super(args);
        this.choiceToLabelFunc = args.choiceToLabelFunc;
    }
    getHtmlFile(){
        return "./v2/dialog/dialogsinglechoice.html";
    }
    getStyleFile(){
        return "./v2/dialog/dialogsinglechoice.css";
    }
    async renderSpecific({root}){
        this.dialogElement = root;

        this.dialogElement.innerHTML = "";
        for(const choice of this.dialog.choices){
            const choiceElement = document.createElement("div");
            choiceElement.classList.add("dialogchoice");
            choiceElement.innerHTML = this.choiceToLabelFunc(choice);
            choiceElement.onclick = async () => await EventBus.post(new SingleChoiceChosen(choice));
            this.dialogElement.appendChild(choiceElement);
        }
    }
}
export class SingleChoiceChosen{
    constructor(choice){
        this.choice = choice;
    }
}


export class ControlDialogInput extends ControlDialog {
    static getDialogArgs(args){
        return {args,dialogclass:DialogInput,controlclass:ControlDialogInput,waitForClass:InputSubmitted};
    }
    static async show(args = {position,choices,choiceToLabelFunc}){
        return showDialog(ControlDialogInput.getDialogArgs(args));        
    }
    static async showAndWait(args){      
        const result = (await showDialogAndWait(ControlDialogInput.getDialogArgs(args)));
        if(!result) return;
        
        return result.text;
    }
    constructor(args = {dialog}){
        super(args);
    }
    getHtmlFile(){
        return "./v2/dialog/dialoginput.html";
    }
    getStyleFile(){
        return "./v2/dialog/dialoginput.css";
    }
    async renderSpecific({root}){
        this.dialogElement = root;

        this.titleElement = await this.$(".dialoginputtitle");
        this.labelElement = await this.$("label");
        this.textElement = await this.$("input");
        this.okElement = await this.$(".dialogbuttonok");
        this.cancelElement = await this.$(".dialogbuttoncancel");
        
        const initialText = this.dialog.initialText;
        
        this.textElement.value = initialText ? initialText : "";
        if(initialText){
            this.textElement.select();
        }
        this.titleElement.innerHTML = this.dialog.title;
        this.labelElement.innerHTML = this.dialog.placeholder;
        const submit = async () => {
            const text = this.textElement.value;
            await EventBus.post(new InputSubmitted(text));
        }
        UtilDOM.onEnterKey(this.textElement,async ()=> await submit())
        this.okElement.onclick = async ()=> await submit();
        this.cancelElement.onclick = async () => await EventBus.post(new InputSubmitted(null));
    }
    onShown(){
        this.textElement.focus()
    }
}

export class ControlDialogDialogProgress extends ControlDialog {
    static getDialogArgs(args){
        return {args,dialogclass:DialogProgress,controlclass:ControlDialogDialogProgress};
    }
    static async show(args = {position,title,text}){
        return showDialog(ControlDialogDialogProgress.getDialogArgs(args));        
    }
    constructor(args = {dialog}){
        super(args);
    }
    getHtml(){
        return `
        <div class="dialogprogress">
            <div class="dialogprogresstitle"></div>
            <div class="dialogprogresstext"></div>
        </div>
        `
    }
    getStyle(){
        return `
        .dialogprogress{
            padding: 8px;
        }
        .dialogprogresstitle{
            font-weight: bold;
        }
        .dialogprogresstext{
            margin-top: 24px;
            margin-bottom: 8px;
        }
        `
    }
    async renderSpecific({root}){
        this.dialogElement = root;

        this.titleElement = await this.$(".dialogprogresstitle");
        this.textElement = await this.$(".dialogprogresstext");

        this.titleElement.innerHTML = this.dialog.title;
        this.textElement.innerHTML = this.dialog.text;
    }
}
export class ControlDialogOk extends ControlDialog {
    static getDialogArgs(args){
        return {args,dialogclass:DialogOk,controlclass:ControlDialogOk,waitForClass:DialogButtonClicked};
    }
    static async show(args = {position,title,text,showCancel,buttons,buttonsDisplayFunc}){
        return showDialog(ControlDialogOk.getDialogArgs(args));        
    }
    static async showAndWait(args= {position,title,text,showCancel,buttons,buttonsDisplayFunc}){      
        const result = (await showDialogAndWait(ControlDialogOk.getDialogArgs(args)));
        if(!result) return;
        
        return result.button;
    }
    constructor(args = {dialog}){
        super(args);
    }
    getHtml(){
        return `
        <div class="dialogok">
            <div class="dialogoktitle"></div>
            <div class="dialogoktext"></div>
            <div class="dialogbuttons"></div>
        </div>
        `
    }
    getStyle(){
        return `
        .dialogok{
            padding: 8px;
            min-width: 300px;
            display: flex;
            flex-direction:column;
        }
        .dialogoktitle{
            font-weight: bold;
        }
        .dialogoktext{
            margin-top: 24px;
            margin-bottom: 8px;
        }
        `
    }
    async renderSpecific({root}){
        this.dialogElement = root;

        this.titleElement = await this.$(".dialogoktitle");
        this.textElement = await this.$(".dialogoktext");
        this.buttonsElement = await this.$(".dialogbuttons");
        const hasCustomButtons = this.dialog.buttons && this.dialog.buttons.length > 0;
        this.buttonsElement.innerHTML = "";
        if(!hasCustomButtons){
            this.buttonElement = await UtilDOM.createElement({type:"div",clazz:"button",content:"OK",parent:this.buttonsElement});
            this.buttonCancelElement = await UtilDOM.createElement({type:"div",classes:"button hidden",content:"Cancel",parent:this.buttonsElement});
            
            this.buttonElement.onclick = async () => {
                if(!UtilDOM.isEnabled(this.buttonElement)) return;

                await EventBus.post(new DialogButtonClicked("ok"));
            }
            this.buttonCancelElement.onclick = async () => await EventBus.post(new DialogButtonClicked("cancel"));
            UtilDOM.showOrHide(this.buttonCancelElement,this.dialog.showCancel);
            this.enableDisableButton(true);
        }else{            
            let displayFunc = this.dialog.buttonsDisplayFunc;
            if(!displayFunc){
                displayFunc = item => item.toString();
            }
            this.dialog.buttons.forEach(async button=>{
                const newButton = await UtilDOM.createElement({type:"div",clazz:"button",content:displayFunc(button),parent:this.buttonsElement});
                newButton.onclick = async () => await EventBus.post(new DialogButtonClicked(button));
            });
        }

        this.titleElement.innerHTML = this.dialog.title;
        this.textElement.innerHTML = this.dialog.text;
    }
    enableDisableButton(enable){
        UtilDOM.enableDisable(this.buttonElement,enable);
    }
}
export class DialogButtonClicked{
    constructor(button){
        this.button = button;
    }
    get isOk(){
        return this.button == "ok";
    }
    get isCancel(){
        return this.button == "cancel";
    }
}
export class InputSubmitted{
    constructor(text){
        this.text = text;
    }
}
