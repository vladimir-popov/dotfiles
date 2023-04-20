return {
    'mfussenegger/nvim-dap',
    ft = { 'c' },
    config = function()
        local dap = require('dap')
        -- Change BP icon
        vim.fn.sign_define(
            'DapBreakpoint',
            { text = '', texthl = 'Error', linehl = '', numhl = '' }
        )
        dap.adapters.lldb = {
            type = 'executable',
            command = '/opt/homebrew/opt/llvm/bin/lldb-vscode',
            name = 'lldb',
        }
        dap.configurations.c = {
            {
                name = 'Launch debug for C',
                type = 'lldb',
                request = 'launch',
                program = function()
                    return vim.fn.input(
                        'Path to executable: ',
                        vim.fn.getcwd() .. '/build/',
                        'file'
                    )
                end,
                cwd = '${workspaceFolder}',
                stopOnEntry = false,
                args = {},
            },
        }
    end,
    keys = {
        {
            '<F21>', -- Shift+F9
            ':lua require"dap".continue()<cr>',
            desc = 'Launching debug sessions and resuming execution',
        },
        {
            '<F9>',
            ':lua require"dap".run_last()<cr>',
            desc = 'Re-runs the last debug adapter / configuration that ran using',
        },
        {
            '<F33>', -- Ctrl+F9
            ':lua require"dap".terminate()<cr>',
            desc = 'Terminate debug session',
        },
        {
            '<F7>',
            ':lua require"dap".step_into()<cr>',
            desc = 'Step into',
        },
        {
            '<F8>',
            ':lua require"dap".step_over()<cr>',
            desc = 'Step over',
        },
        {
            '<space>db',
            ':lua require"dap".toggle_breakpoint()<cr>',
            desc = 'Toggle breakpoint',
        },
        {
            '<space>dB',
            ':lua require"dap".set_breakpoint(vim.fn.input("Breakpoint condition: "))<cr>',
            desc = 'Set breakpoint with condition',
        },
        {
            '<space>dc',
            ':lua require"dap".clear_breakpoints()<cr>',
            desc = 'Remove all breakpoints',
        },
        {
            '<space>dl',
            ':lua require"dap".list_breakpoints()<cr>',
            desc = 'Lists all breakpoints and log points in quickfix window.',
        },
        {
            '<space>dr',
            ':lua require"dap".repl.open()<cr>',
            desc = 'Open debug REPL',
        },
        {
            '<space>dh',
            ':lua require"dap.ui.widgets".hover()<cr>',
            desc = 'View the value for the expression under the cursor in a floating window',
        },
        {
            '<space>dp',
            ':lua require"dap.ui.widgets".preview()<cr>',
            desc = '',
        },
        {
            '<space>ds',
            function()
                local widgets = require('dap.ui.widgets')
                local my_sidebar = widgets.sidebar(widgets.scopes)
                my_sidebar.open()
            end,
            desc = 'Show debug scopes',
        },
        {
            '<space>df',
            function()
                local widgets = require('dap.ui.widgets')
                widgets.centered_float(widgets.frames)
            end,
            desc = 'Show debug frames',
        },
    },
}
