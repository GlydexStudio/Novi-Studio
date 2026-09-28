package com.glydexstudio.novistudio.terminal

import android.content.Context
import android.net.Uri
import com.glydexstudio.novistudio.filesystem.SafFileSystem
import com.glydexstudio.novistudio.node.NodeRuntimeManager
import com.glydexstudio.novistudio.runtime.NoviRuntimeEngine
import java.io.File

class TerminalManager(
    context: Context,
    private val fs: SafFileSystem,
    private val runtime: NoviRuntimeEngine,
    private val node: NodeRuntimeManager = NodeRuntimeManager(context)
) {
    data class TerminalResult(val command: String, val stdout: String, val stderr: String, val exitCode: Int, val durationMs: Long)

    fun nodeStatus(): NodeRuntimeManager.Status = node.status()
    fun startNode(): Result<Unit> = node.start()
    fun stopNode() = node.stop()

    fun run(command: String, cwd: File, callback: (TerminalResult) -> Unit) {
        val trimmed=command.trim(); val start=System.nanoTime()
        try {
            if(trimmed.contains("&&") || trimmed.contains(";") || trimmed.contains("|") || trimmed.contains(">") || trimmed.contains("<")) throw SecurityException("Pipelines, redirections and command chaining are disabled")
            val args=tokenize(trimmed)
            if(args.isEmpty()) { callback(TerminalResult(command,"","",0,0)); return }
            when(args.first()) {
                "novi" -> runNoviCommand(command,args.drop(1),start,callback)
                "node" -> runNodeCommand(command,args.drop(1),cwd,start,callback)
                "npm" -> runNodeCommand(command,listOf("node_modules/npm/bin/npm-cli.js")+args.drop(1),cwd,start,callback)
                else -> throw SecurityException("Unsupported command '${args.first()}'. Allowed commands: novi, node, npm.")
            }
        } catch(e:Exception) { callback(TerminalResult(command,"",e.message ?: "Command failed",1,(System.nanoTime()-start)/1_000_000)) }
    }

    private fun runNoviCommand(command:String,args:List<String>,start:Long,cb:(TerminalResult)->Unit) {
        if(args.isEmpty() || args.first() in listOf("--help","-h")) {
            cb(TerminalResult(command,"Novi ${runtime.version()}\n\nUsage:\n  novi <file.novi>\n  novi --help\n  novi --version","",0,(System.nanoTime()-start)/1_000_000)); return
        }
        if(args.first() in listOf("--version","-v")) { cb(TerminalResult(command,"Novi ${runtime.version()}","",0,(System.nanoTime()-start)/1_000_000)); return }
        require(args.size==1) { "Novi terminal accepts exactly one source file" }
        val relative=args[0]
        require(!relative.startsWith("/") && !relative.split('/').contains("..")) { "Invalid Novi source path" }
        val root=fs.rootUri() ?: throw IllegalStateException("Select a Novi project folder first")
        val uri=findFile(Uri.parse(root),relative.split('/').filter{it.isNotBlank()}) ?: throw IllegalArgumentException("Could not find '$relative'")
        if(!relative.endsWith(".novi",true)) throw IllegalArgumentException("Novi source files must use .novi")
        runtime.execute(fs.read(uri),relative){result->
            val stdout=result.output.joinToString("\n")
            val stderr=if(result.ok) "" else (result.error ?: "Novi error")
            cb(TerminalResult(command,stdout,stderr,if(result.ok)0 else 1,(System.nanoTime()-start)/1_000_000))
        }
    }

    private fun findFile(parent:Uri,segments:List<String>):Uri? {
        if(segments.isEmpty()) return parent
        val next=fs.list(parent).firstOrNull{it.name==segments.first()} ?: return null
        val child=Uri.parse(next.uri)
        if(segments.size==1) return if(next.isDirectory) null else child
        if(!next.isDirectory) return null
        return findFile(child,segments.drop(1))
    }

    private fun runNodeCommand(command:String,args:List<String>,cwd:File,start:Long,cb:(TerminalResult)->Unit) {
        try { val r=node.execute(args,cwd); cb(TerminalResult(command,r.stdout,r.stderr,r.exitCode,r.durationMs)) }
        catch(e:Exception) { cb(TerminalResult(command,"",e.message ?: "Node unavailable",1,(System.nanoTime()-start)/1_000_000)) }
    }

    private fun tokenize(s:String):List<String>{
        val out=mutableListOf<String>(); val cur=StringBuilder(); var quote:Char?=null; var i=0
        while(i<s.length){val ch=s[i]; if(quote!=null){if(ch==quote){quote=null}else if(ch=='\\' && i+1<s.length){i++;cur.append(s[i])}else cur.append(ch)} else {when{ch=='\''||ch=='"'->quote=ch;ch.isWhitespace()->{if(cur.isNotEmpty()){out+=cur.toString();cur.clear()}};else->cur.append(ch)}};i++}
        require(quote==null){"Unterminated quote"}; if(cur.isNotEmpty()) out+=cur.toString(); return out
    }
}
