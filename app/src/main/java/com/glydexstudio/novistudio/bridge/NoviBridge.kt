package com.glydexstudio.novistudio.bridge

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.glydexstudio.novistudio.filesystem.SafFileSystem
import com.glydexstudio.novistudio.npm.NpmManager
import com.glydexstudio.novistudio.npm.NoviPackUpdater
import com.glydexstudio.novistudio.project.ProjectManager
import com.glydexstudio.novistudio.runtime.NoviRuntimeEngine
import com.glydexstudio.novistudio.terminal.TerminalManager
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors

class NoviBridge(
    private val activity: Activity,
    private val web: WebView,
    private val fs: SafFileSystem,
    private val projects: ProjectManager,
    private val runtime: NoviRuntimeEngine
) {
    private val main=Handler(Looper.getMainLooper())
    private val io=Executors.newCachedThreadPool()
    private val terminal=TerminalManager(activity,fs,runtime)
    private val npm=NpmManager(activity)
    private val packUpdater=NoviPackUpdater(activity,npm)

    @JavascriptInterface fun appInfo(): String = JSONObject().put("name","Novi Studio").put("publisher","Glydex Studio").put("version","1.0.0").put("noviVersion",runtime.version()).toString()
    @JavascriptInterface fun runtimeInfo(): String = JSONObject().put("version",runtime.version()).put("isolated",true).toString()
    @JavascriptInterface fun pickFolder(){ activity.runOnUiThread{ activity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION),1001) } }
    @JavascriptInterface fun pickFile(){ activity.runOnUiThread{ activity.startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION),1002) } }
    @JavascriptInterface fun listFolder(uri:String):String = JSONArray(fs.list(Uri.parse(uri)).map{JSONObject().put("uri",it.uri).put("name",it.name).put("directory",it.isDirectory).put("size",it.size).put("modified",it.modified)}).toString()
    @JavascriptInterface fun readFile(uri:String){ val id="read-${System.nanoTime()}"; io.execute{ try{ val text=fs.read(Uri.parse(uri)); emit("fileRead",JSONObject().put("id",id).put("uri",uri).put("content",text)) }catch(e:Exception){ emit("error",JSONObject().put("message",e.message ?: "Read failed")) } } }
    @JavascriptInterface fun writeFile(uri:String,content:String){ io.execute{ try{fs.write(Uri.parse(uri),content); emit("fileSaved",JSONObject().put("uri",uri))}catch(e:Exception){emit("error",JSONObject().put("message",e.message ?: "Save failed"))}}}
    @JavascriptInterface fun createFile(parent:String,name:String){ io.execute{emit("fileCreated",JSONObject().put("uri",fs.createFile(Uri.parse(parent),name,"text/plain").toString()))}}
    @JavascriptInterface fun createFolder(parent:String,name:String){ io.execute{emit("folderCreated",JSONObject().put("uri",fs.createFolder(Uri.parse(parent),name).toString()))}}
    @JavascriptInterface fun rename(uri:String,name:String){ io.execute{emit("renamed",JSONObject().put("uri",fs.rename(Uri.parse(uri),name).toString()))}}
    @JavascriptInterface fun delete(uri:String){ io.execute{fs.delete(Uri.parse(uri));emit("deleted",JSONObject().put("uri",uri))}}
    @JavascriptInterface fun copyFile(uri:String,parent:String,name:String){ io.execute{emit("copied",JSONObject().put("uri",fs.copyItem(Uri.parse(uri),Uri.parse(parent),name).toString()))}}
    @JavascriptInterface fun move(uri:String,sourceParent:String,targetParent:String){ io.execute{ try{ val moved=android.provider.DocumentsContract.moveDocument(activity.contentResolver,Uri.parse(uri),Uri.parse(sourceParent),Uri.parse(targetParent)) ?: throw IllegalStateException("Move failed"); emit("moved",JSONObject().put("uri",moved.toString())) }catch(e:Exception){emit("error",JSONObject().put("message",e.message ?: "Move failed"))}}}
    @JavascriptInterface fun openProject(uri:String){ io.execute{ try{val p=projects.open(Uri.parse(uri));emit("projectOpened",JSONObject().put("uri",p.rootUri.toString()).put("name",p.name).put("entry",p.entry))}catch(e:Exception){emit("error",JSONObject().put("message",e.message ?: "Invalid project"))}}}
    @JavascriptInterface fun newProject(parent:String,name:String){ io.execute{ try{val p=projects.create(Uri.parse(parent),name);emit("projectCreated",JSONObject().put("uri",p.rootUri.toString()).put("name",p.name).put("entry",p.entry))}catch(e:Exception){emit("error",JSONObject().put("message",e.message ?: "Could not create project"))}}}
    @JavascriptInterface fun runNovi(source:String,filename:String){ runtime.execute(source,filename){emit("runResult",it.toJson())} }
    @JavascriptInterface fun diagnose(source:String,filename:String){ runtime.diagnose(source,filename){a-> val arr=JSONArray();a.forEach{arr.put(JSONObject().put("severity",it.severity).put("message",it.message).put("line",it.line).put("column",it.column).put("kind",it.kind))}; emit("diagnostics",JSONObject().put("items",arr))} }
    @JavascriptInterface fun format(source:String,filename:String){ runtime.format(source,filename){ok,out,error->emit("formatResult",JSONObject().put("ok",ok).put("source",out).put("error",error))} }
    @JavascriptInterface fun runTerminal(command:String,cwd:String){ terminal.run(command,File(cwd)){r->emit("terminalResult",JSONObject().put("command",r.command).put("stdout",r.stdout).put("stderr",r.stderr).put("exitCode",r.exitCode).put("durationMs",r.durationMs))} }
    @JavascriptInterface fun nodeStatus(){io.execute{val s=terminal.nodeStatus();emit("nodeStatus",JSONObject().put("provisioned",s.provisioned).put("running",s.running).put("version",s.version).put("abi",s.abi).put("reason",s.reason))}}
    @JavascriptInterface fun startNode(){io.execute{val result=terminal.startNode(); if(result.isSuccess){val s=terminal.nodeStatus();emit("nodeStatus",JSONObject().put("provisioned",s.provisioned).put("running",s.running).put("version",s.version).put("abi",s.abi).put("reason",s.reason))}else{emit("error",JSONObject().put("message",result.exceptionOrNull()?.message ?: "Could not start embedded Node.js"))}}}
    @JavascriptInterface fun stopNode(){io.execute{terminal.stopNode(); val s=terminal.nodeStatus();emit("nodeStatus",JSONObject().put("provisioned",s.provisioned).put("running",s.running).put("version",s.version).put("abi",s.abi).put("reason",s.reason))}}
    @JavascriptInterface fun npmLatest(){io.execute{try{val v=npm.fetchLatest();emit("npmLatest",JSONObject().put("name",v.name).put("version",v.version).put("tarball",v.tarball).put("integrity",v.integrity))}catch(e:Exception){emit("error",JSONObject().put("message","Novi Pack check failed: ${e.message ?: "network error"}"))}}}
    @JavascriptInterface fun updateNoviPack(){ val current=runtime.version(); packUpdater.update(current){r-> if(!r.ok){emit("packUpdateResult",JSONObject().put("ok",false).put("error",r.error))}else if(r.bundle==null){emit("packUpdateResult",JSONObject().put("ok",true).put("version",r.version).put("message",r.message))}else{runtime.stageValidateAndActivate(r.bundle,r.version!!){activeOk,error->emit("packUpdateResult",JSONObject().put("ok",activeOk).put("version",if(activeOk)r.version else current).put("error",error))}} } }
    @JavascriptInterface fun reloadRuntime(){ runtime.initialize(); emit("runtimeReloaded",JSONObject().put("version",runtime.version())) }

    fun onActivityResult(requestCode:Int,resultCode:Int,data:Intent?){ if(resultCode!=Activity.RESULT_OK || data?.data==null)return; val uri=data.data!!; if(requestCode==1001){fs.setRoot(uri);emit("folderSelected",JSONObject().put("uri",uri.toString()).put("name",uri.lastPathSegment ?: "Project folder"))} else if(requestCode==1002){emit("fileSelected",JSONObject().put("uri",uri.toString()).put("name",uri.lastPathSegment ?: "File"))} }

    private fun emit(event:String,data:JSONObject){main.post{web.evaluateJavascript("window.NoviApp && window.NoviApp.onNativeEvent(${JSONObject.quote(event)}, ${JSONObject.quote(data.toString())})",null)}}
    fun dispose(){ terminal.stopNode(); io.shutdownNow() }
}
