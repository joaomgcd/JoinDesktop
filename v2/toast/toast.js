import { Control } from "../control.js";
import { UtilDOM } from "../utildom.js";

export class Toast extends Control{
    constructor(){
        super();
    }
    getHtmlFile(){
        return "./v2/toast/toast.html";
    }
    async getStyleFile(){
        return "./v2/toast/toast.css";
    }
    
    async renderSpecific({root}){
        this.toastTextElement = root;
        return root;
    }
    async show({text,isError,time=2000}){
        if(!this.toastTextElement) return;
        
        this.toastTextElement.innerHTML = text;
        if(isError){
            this.toastTextElement.classList.add("error");
        }else{
            this.toastTextElement.classList.remove("error");
        }
        UtilDOM.show(this.toastTextElement);
        await Util.sleep(time);
        UtilDOM.hide(this.toastTextElement);
    }
}

export class ShowToast{
    constructor(args={text,isError,time}/*same as toast*/){
        Object.assign(this,args);
    }
}