import { Control } from "../../control.js";
import { ApiField,ApiFields } from "./apifield.js";
import { EventBus } from "../../eventbus.js";


export class ControlApiField extends Control{
    
    /**
     * 
     * @param {ApiField} apiField 
     */
    constructor(apiField){
        super()
        this.apiField = apiField;
    }
    getHtmlFile(){
        return "./v2/api/builder/apifield.html";
    }
    getStyleFile(){
        return "./v2/api/builder/apifield.css";
    }
   
    async renderSpecific({root}){
        root.id = this.apiField.id;
        this.labelElement = await this.$("label");
        this.textElement = await this.$("input");

        this.data = this.apiField;
        if(this.apiField.id == ApiFields.generatedUrlFieldId){
            this.textElement.readOnly = true;
            this.textElement.onclick = e => {
                e.target.select();
            }
        }else{
            this.textElement.value = "";
            this.textElement.readOnly = false;
            this.textElement.onkeyup = e => {
                EventBus.post(new RequestGenerateUrl());
            }
        }
    }
    
    get dynamicElements(){
        return true;
    }
    get value(){
        return this.textElement.value;
    }
    set value(value){
        this.textElement.value = value;
    }
}
class RequestGenerateUrl{}