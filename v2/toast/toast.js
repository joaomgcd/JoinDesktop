import { Control } from "../control.js";
import { UtilDOM } from "../utildom.js";

export class Toast extends Control{
    constructor(){
        super();
    }
    getHtml(){
        return `<div class="toast hidden"></div>`;
    }
    getStyle(){
        return `
        .toast {
            display: block;
            position: fixed;
            min-height: 48px;
            min-width: 288px;
            padding: 16px 24px 12px;
            box-sizing: border-box;
            box-shadow: 0 2px 5px 0 rgba(0, 0, 0, 0.26);
            border-radius: 2px;
            left: 0;
            bottom: 0;
            margin: 12px;
            font-size: 14px;
            cursor: default;
            transition: visibility 0.3s, transform 0.3s, opacity 0.3s;
            background-color: green;
            color: #f1f1f1;
        }
        .toast.hidden{
            display: block !important;
            opacity: 0;
            transform: translateY(100px);
        }
        .toast.error{
            background-color: red;
        }
        `
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
        UtilDOM.addAttribute(this.toastTextElement,"role","alert");
        await Util.sleep(time);
        UtilDOM.hide(this.toastTextElement);
        UtilDOM.removeAttribute(this.toastTextElement,"role");
    }
}

export class ShowToast{
    constructor(args={text,isError,time}/*same as toast*/){
        Object.assign(this,args);
    }
}