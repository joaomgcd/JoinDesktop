import { Control } from "../../control.js"
import { AppContext } from "../../appcontext.js";

export class ControlGoogleAccount extends Control{
    getHtmlFile(){
        return "./v2/google/account/googleaccount.html";
    }
    getStyleFile(){
        return "./v2/google/account/googleaccount.css";
    }
    
    async renderSpecific({root}){        
        this.signInButtonElement = await this.$("#signInButton");

        
    }
    get signInElement(){
        return this.signInButtonElement;
    }
    
}