import { fromJS } from "immutable"
import React, {PropTypes, Component} from "react"
import {FormattedDate} from "react-intl"
import {Link} from "react-router";
import Inspector from "react-json-inspector";
import connectToStores from "alt/utils/connectToStores"
import WalletUnlock from "components/Wallet/WalletUnlock"
import WalletUnlockActions from "actions/WalletUnlockActions"
import WalletActions from "actions/WalletActions"
import CachedPropertyActions from "actions/CachedPropertyActions"
import WalletManagerStore from "stores/WalletManagerStore"
import WalletDb, { legacyUpgrade } from "stores/WalletDb"
import BackupStore from "stores/BackupStore"
// import BackupActions, {backup, restore} from "actions/BackupActions"
import { Backup } from "@graphene/wallet-client"
import {saveAs} from "common/filesaver.js"
import notify from "actions/NotificationActions"
import cname from "classnames"
import { hash } from "@graphene/ecc"
import Translate from "react-translate-component";
import { chain_config } from "@graphene/chain"

class BackupBaseComponent extends Component {
    
    static getStores() {
        return [WalletManagerStore, WalletDb, BackupStore]
    }
    
    static getPropsFromStores() {
        var wallet = WalletManagerStore.getState()
        var ww = WalletDb.getState()
        wallet.current_wallet = ww.current_wallet
        wallet.wallet_names = ww.wallet_names
        var backup = BackupStore.getState()
        return { wallet, backup }
    }
    
}

//The default component is WalletManager.jsx 

@connectToStores
export class BackupCreate extends BackupBaseComponent {
    render() {
        return <span>

            <h3><Translate content="wallet.create_backup" /></h3>
            
            <WalletUnlock>
                <Create>
                    <NameSizeModified/>
                    <Sha1/>
                    <Download/>
                    <Reset/>
                </Create>
            </WalletUnlock>
            
        </span>
    }
}

// @connectToStores
// export class BackupVerify extends BackupBaseComponent {
//     render() {
//         return <span>
// 
//             <h3><Translate content="wallet.verify_prior_backup" /></h3>
// 
//             <Upload>
//                 <NameSizeModified/>
//                 <DecryptBackup saveWalletObject={true}>
//                     <h4><Translate content="wallet.verified" /></h4>
//                     <WalletObjectInspector
//                         walletObject={this.props.backup.wallet_object}/>
//                 </DecryptBackup>
//                 <Reset/>
//             </Upload>
//         
//         </span>
//     }
// }

// layout is a small project
// class WalletObjectInspector extends Component {
//     static propTypes={ walletObject: PropTypes.object }
//     render() {
//         return <div style={{overflowY:'auto'}}>
//             <Inspector
//                 data={ this.props.walletObject || {} }
//                 search={false}/>
//         </div>
//     }
// }

@connectToStores
export class BackupRestore extends BackupBaseComponent {
    
    static propTypes = {
        wallet: React.PropTypes.object
    }
    
    constructor() {
        super()
        this.state = {
            newWalletName: null
        }
    }
    
    render() {
        var new_wallet = this.props.wallet.new_wallet
        var has_new_wallet = this.props.wallet.wallet_names.has(new_wallet)
        // FIXME restored
        var restored = has_new_wallet
        
        return <span>

            <h3><Translate content="wallet.import_backup" /></h3>
            {(new FileReader).readAsBinaryString ? null : <p className="error">Warning! You browser doesn't support some some file operations required to restore backup, we recommend you to use Chrome or Firefox browsers to restore your backup.</p>}
            <Upload>
                <NameSizeModified/>
                <DecryptBackup saveWalletObject={true}>
                    <NewWalletName newNameFunc={this.onNewName.bind(this)}/>
                </DecryptBackup>
                {/*restored ?
                <span>
                    <h5><Translate content="wallet.restore_success" name={new_wallet.toUpperCase()} /></h5>
                    <div>{this.props.children}</div>
                </span>:null*/}
                <Reset label={restored ? <Translate content="wallet.done" /> : <Translate content="wallet.reset" />}/>
            </Upload>
        </span>
                    //     <Restore/>
                    // </NewWalletName>
    }
    
    onNewName(new_wallet) {
        WalletActions.restore(
            new_wallet,
            this.props.backup.wallet_object,
            this.props.wallet.password
        )
    }
}

@connectToStores
class NewWalletName extends BackupBaseComponent {
    
    constructor() {
        super()
        this.state = {
            new_wallet: null,
            accept: false
        }
    }
    
    componentWillMount() {
        var has_current_wallet = !!this.props.wallet.current_wallet
        if( ! has_current_wallet) {
            WalletManagerStore.setState({ new_wallet: "default" })
            this.setState({accept: true})
        }
        if( has_current_wallet && this.props.backup.name && ! this.state.new_wallet) {
            let new_wallet = this.props.wallet.new_wallet
            if( ! new_wallet)
                // Should not happen.
                // Begning of the file name might make a good wallet name
                new_wallet = this.props.backup.name.match(/[a-z0-9_-]*/)[0]
            
            this.setState({new_wallet})
        }
    }
    
    render() {
        if(this.state.accept)
            return <span>{this.props.children}</span>
        
        var has_wallet_name = !!this.state.new_wallet
        var has_wallet_name_conflict = has_wallet_name ?
            this.props.wallet.wallet_names.has(this.state.new_wallet) : false
        var name_ready = ! has_wallet_name_conflict && has_wallet_name
        
        return <span>
            <h5><Translate content="wallet.new_wallet_name" /></h5>
            <input type="text" id="new_wallet"
                onChange={this.formChange.bind(this)}
                value={this.state.new_wallet} />
            <p>{ has_wallet_name_conflict ? <Translate content="wallet.wallet_exist" /> : null}</p>
            <div className={cname("button success", {disabled: ! name_ready})}
                onClick={this.onAccept.bind(this)}><Translate content="wallet.accept" /></div>
        </span>
    }
    
    onAccept() {
        this.setState({accept: true})
        WalletManagerStore.setState({ new_wallet: this.state.new_wallet })
        this.props.newNameFunc(this.state.new_wallet)
    }
    
    formChange(event) {
        var key_id = event.target.id
        var value = event.target.value
        if(key_id === "new_wallet") {
            //case in-sensitive
            value = value.toLowerCase()
            // Allow only valid file name characters
            if( /[^a-z0-9_-]/.test(value) ) return
        }
        var state = {}
        state[key_id] = value
        this.setState(state)
    }
    
}

@connectToStores
class Download extends BackupBaseComponent {
    
    componentWillMount() {
        try { this.isFileSaverSupported = !!new Blob; } catch (e) {}
    }
    
    componentDidMount() {
        if( ! this.isFileSaverSupported )
            notify.error("File saving is not supported")
    }
    
    render() {
        return <span className="button success"
            onClick={this.onDownload.bind(this)}><Translate content="wallet.download" /></span>
    }
    
    onDownload() {
        var blob = new Blob([ this.props.backup.contents ], {
            type: "application/octet-stream; charset=us-ascii"})
        
        if(blob.size !== this.props.backup.size)
            throw new Error("Invalid backup to download conversion")
        
        saveAs(blob, this.props.backup.name);
        WalletActions.setBackupDate()
    }
}

@connectToStores
class Create extends BackupBaseComponent {
    
    render() {
        var has_backup = !!this.props.backup.contents
        if( has_backup ) return <div>{this.props.children}</div>
        
        var ready = ! WalletDb.isLocked()
        
        return <div>
            <div onClick={this.onCreateBackup.bind(this)}
                className={cname("button success", {disabled: !ready})}>
                <Translate content="wallet.create_backup_of" name={this.props.wallet.current_wallet} /></div>
            <LastBackupDate/>
        </div>
    }
    
    onCreateBackup() {
        let { current_wallet, wallet } = WalletDb.getState()
        let name = current_wallet
        var address_prefix = chain_config.address_prefix.toLowerCase()
        if(name.indexOf(address_prefix) !== 0)
            name = address_prefix + "_" + name
        name = name + ".bin"
        let contents = new Buffer(wallet.storage.state.get("encrypted_wallet"), "base64")
        BackupActions.incommingBuffer({name, contents})
    }

}

class LastBackupDate extends Component {
    render() {
        var backup_date = WalletDb.prop("backup_date")
        var last_modified = new Date(WalletDb.prop("last_modified"))
        var backup_time = backup_date ?
            <h4><Translate content="wallet.last_backup" /> <FormattedDate value={backup_date}/></h4>:
            <h4><Translate content="wallet.never_backed_up" /></h4>
        var needs_backup = null
        if( backup_date ) {
            needs_backup = last_modified.getTime() > new Date(backup_date).getTime() ?
                <h4><Translate content="wallet.need_backup" /></h4>:
                <h4 className="success"><Translate content="wallet.noneed_backup" /></h4>
        }
        return <span>
            {backup_time}
            {needs_backup}
        </span>
    }
}

@connectToStores
class Upload extends BackupBaseComponent {
    
    render() {
        if(
            this.props.backup.contents &&
            this.props.backup.public_key
        )
            return <span>{this.props.children}</span>
        
        var is_invalid =
            this.props.backup.contents &&
            ! this.props.backup.public_key

        return <span>
            <input type="file" id="backup_input_file" style={{ border: 'solid' }}
                onChange={this.onFileUpload.bind(this)} />
            { is_invalid ? <h5><Translate content="wallet.invalid_format" /></h5> : null }
        </span>
    }
    
    onFileUpload(evt) {
        var file = evt.target.files[0]
        BackupActions.incommingWebFile(file)
        this.forceUpdate()
    }
}


@connectToStores
class NameSizeModified extends BackupBaseComponent {
    render() {
        return <span>
            <h5><b>{this.props.backup.name}</b> ({this.props.backup.size} bytes)</h5>
            {this.props.backup.last_modified ?
                <div>{this.props.backup.last_modified}</div> : null }
            <br/>
        </span>
    }
}

@connectToStores
class DecryptBackup extends BackupBaseComponent {
    
    static propTypes = {
        saveWalletObject: PropTypes.bool
    }
    
    constructor() {
        super()
        this.state = this._getInitialState()
    }
    
    _getInitialState() {
        return {
            backup_password: null,
            verified: false
        }
    }
    
    render() {
        if(this.state.verified) return <span>{this.props.children}</span>
        return <span>
            <label><Translate content="wallet.enter_password" /></label>
            <input type="password" id="backup_password"
                onChange={this.formChange.bind(this)}
                value={this.state.backup_password}/>
            <Sha1/>
            <span className="button success"
                onClick={this.onPassword.bind(this)}><Translate content="wallet.verify" /></span>
        </span>
    }
    
    onPassword() {

        let email = ""
        let username = ""
        let password = this.state.backup_password || ""
        
        let backupDecrypt = private_key => new Promise( (resolve, reject) =>{
            try {resolve(
                Backup.decrypt(this.props.backup.contents, private_key).then( restored_object => {
                    
                    if(restored_object.chain_id && restored_object.chain_id !== Apis.chainId()) {
                        throw new Error("Missmatched chain id")
                    }
                    
                    let wallet_object = Array.isArray(restored_object.wallet) ?
                        legacyUpgrade(password, restored_object) : fromJS(restored_object)
                    
                    WalletManagerStore.setState({
                        new_wallet: wallet_object.get("public_name"),
                        password
                    })
                
                    this.setState({verified: true})
                    if(this.props.saveWalletObject)
                        BackupStore.setWalletObjct(wallet_object)
                })
            )} catch( error ) {
                reject( error )
            }
        })
        
        let notifyError = error => {
            console.error("Backup\trestore error wallet: " + this.props.backup.name, error, "stack", error.stack)
            
            if( /invalid_password/.test(error.toString()) )
                notify.error("Invalid Password")
            
            else if( /Missmatched chain id/.test(error.toString()) )
                notify.error("This is not a " + (chain_config.network_name ? chain_config.network_name : chain_config.address_prefix) + " wallet.")
        }
        
        let private_key = PrivateKey.fromSeed(
            email.trim().toLowerCase() + "\t" +
            username.trim().toLowerCase() + "\t" +
            password
        )
        
        // recent encryption key (and internal JSON format)
        return backupDecrypt(private_key).catch( error => {
            
            if( ! /invalid_password/.test(error.toString()) ) {
                notifyError(error)
                return
            }
            
            // try the legacy encryption key (and JSON format, they are one in the same)
            private_key = PrivateKey.fromSeed(password)
            return backupDecrypt(private_key).catch( error => {
                notifyError(error)
            })
        })
    }
    
    formChange(event) {
        var state = {}
        state[event.target.id] = event.target.value
        this.setState(state)
    }
    
}

@connectToStores
export class Sha1 extends BackupBaseComponent {
    render() { 
        return <div>
            <pre className="no-overflow">{this.props.backup.sha1} * SHA1</pre>
            <br/>
        </div>
    }
}

@connectToStores
class Reset extends BackupBaseComponent {
    
    // static contextTypes = {router: React.PropTypes.func.isRequired}
    
    render() {
        var label = this.props.label || <Translate content="wallet.reset" />
        return  <span className="button cancel"
            onClick={this.onReset.bind(this)}>{label}</span>
    }
    
    onReset() {
        BackupActions.reset()
        window.history.back()
    }
}
