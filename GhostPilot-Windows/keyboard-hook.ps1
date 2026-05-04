$source = @'
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Text;
using System.Threading;

public class KHook {
    const int WH_KEYBOARD_LL = 13;
    const int WM_KEYDOWN    = 0x0100;
    const int WM_SYSKEYDOWN = 0x0104;

    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, HookCb fn, IntPtr mod, uint tid);
    [DllImport("user32.dll")] static extern bool   UnhookWindowsHookEx(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h, int n, IntPtr w, IntPtr l);
    [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string m);
    [DllImport("user32.dll")] static extern short  GetAsyncKeyState(int k);

    delegate IntPtr HookCb(int n, IntPtr w, IntPtr l);

    [StructLayout(LayoutKind.Sequential)]
    struct KBS { public uint vk, sc, fl, t; public IntPtr extra; }

    static IntPtr hook;
    static HookCb cb;
    public static volatile bool Capture = false;

    public static void Start() {
        Console.OutputEncoding = Encoding.UTF8;
        cb   = Proc;
        hook = SetWindowsHookEx(WH_KEYBOARD_LL, cb, GetModuleHandle(null), 0);
        Console.WriteLine("READY");
        Console.Out.Flush();
        Application.Run();
        UnhookWindowsHookEx(hook);
    }

    public static void Stop() { Application.Exit(); }

    // Read commands from stdin on a background thread
    public static void StartStdinReader() {
        ThreadStart ts = new ThreadStart(ReadStdin);
        Thread t = new Thread(ts);
        t.IsBackground = true;
        t.Start();
    }

    static void ReadStdin() {
        try {
            while (true) {
                string line = Console.In.ReadLine();
                if (line == null || line == "STOP") { Stop(); break; }
                if (line == "CAPTURE:1") Capture = true;
                if (line == "CAPTURE:0") Capture = false;
            }
        } catch {}
    }

    static IntPtr Proc(int n, IntPtr w, IntPtr l) {
        if (n >= 0 && ((int)w == WM_KEYDOWN || (int)w == WM_SYSKEYDOWN)) {
            var s   = (KBS)Marshal.PtrToStructure(l, typeof(KBS));
            uint vk = s.vk;
            bool ctrl  = (GetAsyncKeyState(0x11) & 0x8000) != 0;
            bool alt   = (GetAsyncKeyState(0x12) & 0x8000) != 0;
            bool shift = (GetAsyncKeyState(0x10) & 0x8000) != 0;

            // Always pass Ctrl+Alt combos through (GhostPilot hotkeys)
            if (ctrl && alt) return CallNextHookEx(hook, n, w, l);

            if (Capture) {
                string m = (ctrl?"C":"") + (alt?"A":"") + (shift?"S":"");
                Console.WriteLine("KEY:" + vk + ":" + m);
                Console.Out.Flush();
                return (IntPtr)1;  // suppress
            }
        }
        return CallNextHookEx(hook, n, w, l);
    }
}
'@

Add-Type -TypeDefinition $source -ReferencedAssemblies "System.Windows.Forms" -ErrorAction Stop

[KHook]::StartStdinReader()
[KHook]::Start()
