import { Control } from "../control.js";
import { Contacts,Contact } from "./contacts.js";
import { UtilDOM } from "../utildom.js";
import { EventBus } from "../eventbus.js";

export class ControlContactSearch extends Control{
    /**
     * 
     * @param {Contacts} contacts 
     */
    constructor(contacts){
        super();
        this.contacts = contacts;
    }
    getHtmlFile(){
        return "./v2/sms/contactsearch.html";
    }
    getStyleFile(){
        return "./v2/sms/contactsearch.css";
    }
    async renderSpecific({root}){     
        this.contactListElement = await this.$(".contactsearchlist");
        this.inputElement = await this.$(".contactsearchinput");

        await this.renderContacts(this.contacts);
        this.inputElement.oninput = async () => {
            const originalFilter = this.inputElement.value.toLowerCase();
            const filters = originalFilter.split(" ");
            const includesAllFiltersButDoesNotMatchOriginal = value => {
                const lower = value.toLowerCase();
                if(lower == originalFilter) return false;

                for(const filter of filters){
                    if(!lower.includes(filter)) return false;
                }
                return true;
            }
            const exactMatches = this.contacts.filter(contact=>contact.name.toLowerCase() == originalFilter);
            const fuzzyMatches = this.contacts.filter(contact=>includesAllFiltersButDoesNotMatchOriginal(contact.name) || includesAllFiltersButDoesNotMatchOriginal(contact.number));
            fuzzyMatches.sortByMultiple(true,contact=>contact.name.toLowerCase());
            let contacts = [exactMatches,fuzzyMatches].flat();
            if(contacts.length == 0){
                contacts = [new Contact({name:"Unlisted Contact",number:originalFilter})];
            }
            await this.renderContacts(contacts);
        }
        this.inputElement.onkeyup = async e => {
            if(e.keyCode != 13) return;
            if(!this.controlsContactsInSearch || this.controlsContactsInSearch.length == 0) return;

            const contact = this.controlsContactsInSearch[0].contact;
            await EventBus.post(new SelectedContact(contact));
        }
    }
    async renderContacts(contacts){
        this.contactListElement.innerHTML = "";
        this.controlsContactsInSearch = contacts.map(contact=>new ControlContactInSearch(contact));
        for(const controlContactInSearch of this.controlsContactsInSearch){
            const render = await controlContactInSearch.render();
            this.contactListElement.appendChild(render);
        }
    }
    
}
export class ControlContactInSearch extends Control{
    /**
     * 
     * @param {Contact} contact 
     */
    constructor(contact){
        super();
        this.contact = contact;
    }
    getHtmlFile(){
        return "./v2/sms/contactinsearch.html";
    }
    getStyleFile(){
        return "./v2/sms/contactinsearch.css";
    }
    
    async renderSpecific({root}){  
        this.containerElement = root;  
        this.contactPictureElement = await this.$(".smscontactpicture");
        this.contactPictureImageElement = this.contactPictureElement.querySelector("img");
        this.contactPictureUnknownElement = this.contactPictureElement.querySelector("svg");
        this.contactNameElement = await this.$(".smscontactname");
        this.numberElement = await this.$(".smscontactnumber");

        const picture = this.contact.photo;
        if(picture){
            this.contactPictureImageElement.src = picture;
            UtilDOM.show(this.contactPictureImageElement);
            UtilDOM.hide(this.contactPictureUnknownElement);
        }else{
            UtilDOM.show(this.contactPictureUnknownElement);
            UtilDOM.hide(this.contactPictureImageElement);
        }
        this.contactNameElement.innerHTML = this.contact.name;
        this.numberElement.innerHTML = this.contact.number;
        this.containerElement.onclick = async () => await EventBus.post(new SelectedContact(this.contact));
    }
}
class SelectedContact{
    constructor(contact){
        this.contact = contact;
    }
}