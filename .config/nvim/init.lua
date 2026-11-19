vim.opt.termguicolors = true

-- use UTF as encoding by default
vim.opt.encoding = 'UTF-8'

-- turn on spellcheck
vim.opt.spell = true
vim.opt.spelllang = { 'ru', 'en' }
vim.opt.sps = { 'best', 5 }

-- keys mapping
vim.opt.langmap =
"ФИСВУАПРШОЛДЬТЩЗЙКЫЕГМЦЧНЯЖ;ABCDEFGHIJKLMNOPQRSTUVWXYZ:,фисвуапршолдьтщзйкыегмцчня;abcdefghijklmnopqrstuvwxyz"

-- highlight the current line
vim.opt.cursorline = true

-- turn on line numbers
vim.opt.number = true

-- the minimal width of the left column
vim.o.foldcolumn = '2'
vim.o.foldlevel = 99 -- Using ufo provider need a large value, feel free to decrease the value
vim.o.foldlevelstart = 99
vim.o.foldenable = true

vim.g.mapleader = "'"

-- turn relative line numbers on only for active window
-- and not in diff mode
local togglenumber = vim.api.nvim_create_augroup('togglenumber', { clear = true })
vim.api.nvim_create_autocmd({ 'BufEnter', 'FocusGained', 'InsertLeave' }, {
    group = togglenumber,
    pattern = '*',
    callback = function()
        if vim.o.number and vim.fn.mode() ~= 'i' and not vim.o.diff then
            vim.o.rnu = true
        end
    end,
})
vim.api.nvim_create_autocmd({ 'BufLeave', 'FocusLost', 'InsertEnter', 'WinLeave' }, {
    group = togglenumber,
    pattern = '*',
    callback = function()
        if vim.o.number then
            vim.o.rnu = false
        end
    end,
})

-- Re-enter Terminal-mode whenever a terminal window becomes active again.
vim.api.nvim_create_autocmd('WinEnter', {
    group = vim.api.nvim_create_augroup('terminal_insert_on_enter', { clear = true }),
    callback = function()
        if vim.bo.buftype == 'terminal' then
            local win = vim.api.nvim_get_current_win()
            vim.schedule(function()
                if vim.api.nvim_win_is_valid(win) and vim.api.nvim_get_current_win() == win
                    and vim.bo[vim.api.nvim_win_get_buf(win)].buftype == 'terminal' then
                    vim.cmd.startinsert()
                end
            end)
        end
    end,
})

-- turn on undo history
vim.cmd([[
set undodir=~/.vim/undodir
set undofile
set undolevels=1000
set undoreload=10000
]])

-- use rg as grep
vim.cmd([[
set grepprg=rg\ --vimgrep\ --no-heading\ --smart-case
set grepformat+=%f:%l:%c:%m
]])

-- turn on 'global' statusline
vim.opt.laststatus = 3

-- always show sign column
-- (for git hunks and lsp errors)
vim.o.signcolumn = 'yes'

-- do not wrap lines
vim.opt.wrap = false

-- searching configuration:
vim.opt.ignorecase = true
vim.opt.smartcase = true

-- use syntax for folding by default
vim.opt.syntax = 'on'
-- vim.opt.foldmethod = 'syntax'

-- open all folds on the start
-- vim.opt.foldenable = false

vim.api.nvim_create_autocmd({ 'FileType' }, {
    pattern = { '*' },
    callback = function(ev)
        -- Do not comment a new line
        --  t       Auto-wrap text using textwidth
        --  c       Auto-wrap comments using textwidth,
        --          inserting the current comment
        --          leader automatically.
        --  r       Automatically insert the current comment leader after hitting
        --          <Enter> in Insert mode.
        --  o       Automatically insert the current comment leader after hitting
        --          'o' or 'O' in Normal mode.
        -- vim.opt.formatoptions:remove({ 'c', 'r', 'o' })
        vim.opt.formatoptions:remove({ 'o' })
    end,
})

-- a comma separated list of options for Insert mode completion
-- menuone  - use a popup menu to show the possible completions,
--            also when there is only one match;
-- noinsert - do not insert any text for a match until the user
--            selects a match from the menu;
vim.opt.completeopt = { 'menuone', 'noinsert' }
-- Avoid showing message extra message when using completion
vim.opt.shortmess:append('c')
-- Ensure autocmd works for Filetype
vim.opt.shortmess:remove('F')
-- speedup used for the CursorHold autocommand event:
vim.opt.updatetime = 300

-- auto-reload files when modified externally
-- https://unix.stackexchange.com/a/383044
vim.o.autoread = true
vim.api.nvim_create_autocmd({ 'BufEnter', 'CursorHold', 'CursorHoldI', 'FocusGained' }, {
    pattern = { '*' },
    callback = function(arg)
        if vim.fn.mode() ~= 'c' and vim.fn.getcmdwintype() == '' then
            vim.api.nvim_command('checktime')
        end
    end,
})

-- Setup tabline
_G.MyTabLine = function()
    local current_tab = vim.api.nvim_get_current_tabpage()
    local labels = {}

    for i, tab in ipairs(vim.api.nvim_list_tabpages()) do
        local win = vim.api.nvim_tabpage_get_win(tab)
        local buf = vim.api.nvim_win_get_buf(win)
        local name = vim.api.nvim_buf_get_name(buf)
        local label

        if vim.bo[buf].buftype == "terminal" then
            -- Убрать term://...//PID: и оставить только имя команды
            local terminal_name = name:match(".*:(.*)$") or name
            label = vim.fn.fnamemodify(terminal_name, ":t")
        else
            label = vim.fn.pathshorten(vim.fn.fnamemodify(name, ":~"))
        end

        if label == "" then
            label = "[No Name]"
        end

        -- Удвоить %, чтобы tabline не воспринял его как форматный символ
        label = label:gsub("%%", "%%%%")

        local highlight = tab == current_tab and "%#TabLineSel#" or "%#TabLine#"
        labels[#labels + 1] = highlight .. "%" .. i .. "T " .. label .. " %T"
    end

    return table.concat(labels) .. "%#TabLineFill#"
end
vim.o.showtabline = 2
vim.o.tabline = "%!v:lua.MyTabLine()"

-- setup plugins
local lazypath = vim.fn.stdpath('data') .. '/lazy/lazy.nvim'
if not (vim.uv or vim.loop).fs_stat(lazypath) then
    local out = vim.fn.system({
        'git',
        'clone',
        '--filter=blob:none',
        '--single-branch',
        'https://github.com/folke/lazy.nvim.git',
        lazypath,
    })
    if vim.v.shell_error ~= 0 then
        vim.api.nvim_echo({
            { "Failed to clone lazy.nvim:\n", "ErrorMsg" },
            { out,                            "WarningMsg" },
            { "\nPress any key to exit..." },
        }, true, {})
        vim.fn.getchar()
        os.exit(1)
    end
end
vim.opt.runtimepath:prepend(lazypath)

require('lazy').setup('plugins', {
    defaults = { lazy = true },
    checker = { enabled = false },
    change_detection = { enabled = false },
    rocks = {
        enabled = false,
    },
    performance = {
        rtp = {
            disabled_plugins = {
                'gzip',
                'netrwPlugin',
                'tarPlugin',
                'tutor',
                'zipPlugin',
            },
        },
    },
    dev = {
        path = '~/Projects/nvim',
        -- patterns = { 'vladimir-popov' },
    },
    -- debug = true,
})

-- enable lsp
local lsp_configs = {}
for _, f in pairs(vim.api.nvim_get_runtime_file('lsp/*.lua', true)) do
    local server_name = vim.fn.fnamemodify(f, ':t:r')
    table.insert(lsp_configs, server_name)
end
vim.lsp.config('*', {
    on_attach = require('lsp_on_attach'),
    capabilities = require('cmp_nvim_lsp').default_capabilities(),
})
vim.lsp.enable(lsp_configs)

-- setup langmapper
require('langmapper').automapping({ global = true, buffer = true })

-- configure colorscheme according to GLOBAL_THEME tmux variable
GLOBAL_THEME = vim.fn.system('tmux show-environment -g GLOBAL_THEME'):gsub('GLOBAL_THEME=(%w+).*', '%1') or
    vim.env.GLOBAL_THEME
if GLOBAL_THEME == 'light' then
    vim.cmd [[set background=light]]
    vim.cmd.colorscheme "edge"
else
    vim.cmd [[set background=dark]]
    vim.cmd.colorscheme("catppuccin-macchiato")
end
