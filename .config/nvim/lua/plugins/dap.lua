local pickers = require("telescope.pickers")
local finders = require("telescope.finders")
local sorters = require("telescope.sorters")
local actions = require("telescope.actions")
local conf = require("telescope.config").values
local action_state = require("telescope.actions.state")
local entry_display = require("telescope.pickers.entry_display")

local fs_sep = package.config:sub(1, 1)

---@class ProgramOps : TelescopeOpts
---@field extra_args table additional arguments for `fd`
---@field relative_path fn(path: string): string the function to build a relative path to files

---@param buildOpts fun(): ProgramOps
---@return fun(): thread coroutine a function to choose a file to run and debug
local function telescopeProgram(buildOpts)
    -- this function is run to start a debug session
    -- @return the path to executable file for run and debug
    return function()
        return coroutine.create(function(co)
            local opts = buildOpts() or {}
            local cmd = { "fd", "--hidden", "--no-ignore", "--type", "x", unpack(opts.extra_args) }
            -- run ls to sort files and get date and size
            table.insert(cmd, "-X")
            table.insert(cmd, "ls")
            table.insert(cmd, "-lht")
            print(table.concat(cmd, ' '))
            local displayer = entry_display.create {
                separator = " ",
                items = {
                    { width = 12 },
                    { width = 20 },
                    { width = 5 },
                    { remaining = true },
                },
            }

            -- this function is run for every item in the prompt
            local make_display = function(entry)
                return displayer {
                    { entry.date, "TelescopePreviewSticky" },
                    { entry.file },
                    { entry.size, "TelescopePreviewSize" },
                    { entry.dir,  "TelescopePreviewHyphen" },
                }
            end
            pickers
                .new(opts, {
                    prompt_title = "Run for debug",
                    finder = finders.new_oneshot_job(cmd, {
                        entry_maker = function(entry)
                            if entry == "" then
                                return nil
                            end
                            local values = vim.split(entry, ' +')
                            local size = values[5]
                            local date = string.format("%s %s %s", values[6], values[7], values[8])
                            -- the path is all tail items (not only one, because the path can have spaces)
                            -- we concatenate all parts back together
                            local path = table.concat({ unpack(values, 9, #values) }, ' ')
                            -- to split them by fs separator
                            local path_itr = vim.iter(vim.split(path, fs_sep, { plain = true }))
                            local file = path_itr:pop()
                            local dir = table.concat(path_itr:totable(), fs_sep)
                            local entry = {
                                display = make_display,
                                value = values,
                                date = date,
                                file = file,
                                size = size,
                                dir = opts.relative_path(dir),
                                path = path,
                                ordinal = path
                            }
                            return entry
                        end
                    }),
                    sorter = sorters.get_fzy_sorter(opts),
                    attach_mappings = function(buffer_number)
                        actions.select_default:replace(function()
                            actions.close(buffer_number)
                            local selected_entry = action_state.get_selected_entry()
                            coroutine.resume(co, selected_entry and selected_entry.path or nil)
                        end)
                        return true
                    end,
                })
                :find()
        end)
    end
end

---@return fun(): number pid a PID of the process to debug
local function telescopeProcess(opts)
    opts = opts or {}
    local co = coroutine.running()
    if co then
        pickers.new(opts, {
            prompt_title = "PIDs:",
            finder = finders.new_table {
                results = require('dap.utils').get_processes({}),
                entry_maker = function(entry)
                    return {
                        value = entry,
                        display = entry.pid .. ':' .. entry.name,
                        ordinal = entry.name
                    }
                end,
            },
            sorter = conf.generic_sorter(opts),
            attach_mappings = function(prompt_bufnr, map)
                actions.select_default:replace(function()
                    actions.close(prompt_bufnr)
                    local selected_entry = action_state.get_selected_entry()
                    coroutine.resume(co, selected_entry.value.pid)
                end)
                return true
            end,
        }):find()
        return coroutine.yield()
    else
        return require('dap').ABORT
    end
end

local function zigOpts()
    local themes = require("telescope.themes")
    local Path = require("plenary.path")
    local catch_all = '.'
    local global_cache = vim.env.XDG_CACHE_HOME or vim.fs.joinpath(vim.env.HOME, '.cache', 'zig')
    local zig_out = vim.fn.getcwd()
    local opts = themes.get_dropdown({})
    local is_single_file = vim.fn.filereadable('build.zig') == 1
    opts.extra_args = is_single_file and { catch_all, zig_out } or
        { catch_all, './', global_cache }
    opts.relative_path = function(path)
        local p = Path:new(path)
        local relative = nil
        if is_single_file then
            if global_cache == path:sub(1, #global_cache) then
                relative = p:make_relative(global_cache)
            else
                relative = p:make_relative(vim.fn.getcwd())
            end
        else
            relative = p:make_relative(zig_out)
        end
        relative = Path:new(relative):shorten(3, { -1 })
        return relative
    end
    return opts
end

return {
    'mfussenegger/nvim-dap',
    ft = { 'c', 'cpp', 'scala', 'zig' },
    dependencies = { 'nvim-telescope/telescope.nvim', 'nvim-lua/plenary.nvim' },
    config = function()
        local dap = require('dap')
        -- Use "tabnew" for all debug adapters
        dap.defaults.fallback.terminal_win_cmd = 'tabnew'
        dap.set_log_level('DEBUG')
        -- Change BP icon
        vim.fn.sign_define(
            'DapBreakpoint',
            { text = '', texthl = 'Error', linehl = 'Error', numhl = 'Error' }
        )
        -- Configuration for C/C++/zig
        dap.adapters.lldb = {
            type = 'executable',
            command = '/opt/homebrew/opt/llvm/bin/lldb-dap',
            name = 'lldb',
            env = {
                LLDB_LAUNCH_FLAG_LAUNCH_IN_TTY = 'YES',
            },
            attach = {
                pidProperty = 'pid',
                pidSelect = 'ask',
            },
        }

        -- Configuration for Zig
        dap.configurations.zig = {
            {
                name = 'Launch debug for Zig',
                type = 'lldb',
                request = 'launch',
                program = telescopeProgram(zigOpts),
                cwd = '${workspaceFolder}',
                args = {},
                stopOnEntry = false,
                runInTerminal = false,
            },
            {
                name = 'Attach to process',
                type = 'lldb',
                request = 'attach',
                pid = telescopeProcess,
                -- pid = require('dap.utils').pick_process,
                args = {},
            },
        }

        dap.configurations.c = {
            {
                name = 'Launch debug for C',
                type = 'lldb',
                request = 'launch',
                program = telescopeProgram(dependencies),
                cwd = '${workspaceFolder}',
                args = {},
                stopOnEntry = false,
                runInTerminal = false,
            },
            {
                name = 'Attach to process',
                type = 'lldb',
                request = 'attach',
                pid = require('dap.utils').pick_process,
                args = {},
            },
        }
        dap.configurations.cpp = dap.configurations.c

        -- Configuration for Scala
        dap.adapters.scala_cli_server = {
            type = 'server',
            hostName = 'localhost',
            port = 5005,
        }
        dap.configurations.scala = {
            {
                type = 'scala',
                request = 'launch',
                name = 'RunOrTest',
                metals = {
                    runType = 'runOrTestFile',
                    --args = { "firstArg", "secondArg", "thirdArg" }, -- here just as an example
                },
            },
            {
                type = 'scala',
                request = 'launch',
                name = 'Test Target',
                metals = {
                    runType = 'testTarget',
                },
            },
            {
                type = 'scala_cli_server',
                request = 'attach',
                name = 'scala-cli-client',
            },
        }
    end,
    keys = {
        {
            '<F9>',
            ':lua require"dap".continue()<cr>',
            desc = 'Launching debug sessions and resuming execution',
        },
        {
            '<F33>', -- Ctrl+F9
            ':lua require"dap".terminate()<cr>',
            desc = 'Terminate debug session',
        },
        {
            '<F6>',
            ':lua require"dap".step_out()<cr>',
            desc = 'Step out',
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
            '<space>dd',
            ':lua require"dap".continue()<cr>',
            desc = 'Launching debug sessions and resuming execution',
        },
        {
            '<space>dt',
            ':lua require"dap".terminate()<cr>',
            desc = 'Terminate debug session',
        },
        {
            '<space>du',
            ':lua require"dap".step_out()<cr>',
            desc = 'Step out',
        },
        {
            '<space>di',
            ':lua require"dap".step_into()<cr>',
            desc = 'Step into',
        },
        {
            '<space>do',
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
