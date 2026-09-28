package com.glydexstudio.novistudio.debugger

class DebuggerSession {
    private val breakpoints = linkedSetOf<Int>()
    fun addBreakpoint(line:Int) { if(line>0) breakpoints += line }
    fun removeBreakpoint(line:Int) { breakpoints -= line }
    fun clear() = breakpoints.clear()
    fun breakpoints(): Set<Int> = breakpoints.toSet()
    fun isSupported(): Boolean = false
}
