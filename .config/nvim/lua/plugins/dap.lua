local function program()
	local option = 0
	if vim.g.previous_debug then
		local options = "&new\n&previous [" .. vim.g.previous_debug .. "]"
		option = vim.fn.confirm("Which binary run to debug?", options, 2)
	end
	if option < 2 then
		vim.g.previous_debug = vim.fn.input("Path to executable: ", vim.fn.getcwd() .. "/build/", "file")
	end
	if vim.fn.filereadable(vim.g.previous_debug) == 0 then
		if
			vim.fn.confirm(
				"File [" .. vim.g.previous_debug .. "] not found, or can't be read. Run `make`?",
				"&no\n&yes",
				2
			) == 2
		then
			local out = vim.fn.system("make")
			if vim.v.shell_error == 0 then
				print("Build has been successfully done.")
			else
				print("Build has been failed. Exit code: " .. vim.v.shell_error .. "\n" .. out)
			end
			return program()
		end
	end
	return vim.g.previous_debug
end

return {
	"mfussenegger/nvim-dap",
	ft = { "c", "cpp" },
	config = function()
		local dap = require("dap")
		-- Change BP icon
		vim.fn.sign_define("DapBreakpoint", { text = "", texthl = "Error", linehl = "", numhl = "" })
		dap.adapters.lldb = {
			type = "executable",
			command = "/opt/homebrew/opt/llvm/bin/lldb-vscode",
			name = "lldb",
			env = {
				LLDB_LAUNCH_FLAG_LAUNCH_IN_TTY = "YES",
			},
			attach = {
				pidProperty = "pid",
				pidSelect = "ask",
			},
		}
		dap.configurations.c = {
			{
				name = "Launch debug for C",
				type = "lldb",
				request = "launch",
				program = program,
				cwd = "${workspaceFolder}",
				args = {},
				stopOnEntry = false,
				runInTerminal = false,
			},
			{
				name = "Attach to process",
				type = "lldb",
				request = "attach",
				pid = require("dap.utils").pick_process,
				args = {},
			},
		}
		dap.configurations.cpp = dap.configurations.c
	end,
	keys = {
		{
			"<F9>",
			':lua require"dap".continue()<cr>',
			desc = "Launching debug sessions and resuming execution",
		},
		{
			"<F33>", -- Ctrl+F9
			':lua require"dap".terminate()<cr>',
			desc = "Terminate debug session",
		},
		{
			"<F6>",
			':lua require"dap".step_out()<cr>',
			desc = "Step out",
		},
		{
			"<F7>",
			':lua require"dap".step_into()<cr>',
			desc = "Step into",
		},
		{
			"<F8>",
			':lua require"dap".step_over()<cr>',
			desc = "Step over",
		},
		{
			"<space>dd",
			':lua require"dap".continue()<cr>',
			desc = "Launching debug sessions and resuming execution",
		},
		{
			"<space>dt",
			':lua require"dap".terminate()<cr>',
			desc = "Terminate debug session",
		},
		{
			"<space>du",
			':lua require"dap".step_out()<cr>',
			desc = "Step out",
		},
		{
			"<space>di",
			':lua require"dap".step_into()<cr>',
			desc = "Step into",
		},
		{
			"<space>do",
			':lua require"dap".step_over()<cr>',
			desc = "Step over",
		},
		{
			"<space>db",
			':lua require"dap".toggle_breakpoint()<cr>',
			desc = "Toggle breakpoint",
		},
		{
			"<space>dB",
			':lua require"dap".set_breakpoint(vim.fn.input("Breakpoint condition: "))<cr>',
			desc = "Set breakpoint with condition",
		},
		{
			"<space>dc",
			':lua require"dap".clear_breakpoints()<cr>',
			desc = "Remove all breakpoints",
		},
		{
			"<space>dl",
			':lua require"dap".list_breakpoints()<cr>',
			desc = "Lists all breakpoints and log points in quickfix window.",
		},
		{
			"<space>dr",
			':lua require"dap".repl.open()<cr>',
			desc = "Open debug REPL",
		},
		{
			"<space>dh",
			':lua require"dap.ui.widgets".hover()<cr>',
			desc = "View the value for the expression under the cursor in a floating window",
		},
		{
			"<space>dp",
			':lua require"dap.ui.widgets".preview()<cr>',
			desc = "",
		},
		{
			"<space>ds",
			function()
				local widgets = require("dap.ui.widgets")
				local my_sidebar = widgets.sidebar(widgets.scopes)
				my_sidebar.open()
			end,
			desc = "Show debug scopes",
		},
		{
			"<space>df",
			function()
				local widgets = require("dap.ui.widgets")
				widgets.centered_float(widgets.frames)
			end,
			desc = "Show debug frames",
		},
	},
}
