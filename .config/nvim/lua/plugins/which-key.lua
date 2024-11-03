local sep = package.config:sub(1, 1)

local function gitlabFile()
    local commit = '-/tree/master'
    local rcGitlabUrl = 'https://git.ringcentral.com/dash'
    local analyticsGitlabUrl = 'https://gitlab.ponylab.ringcentral.com/dash'
    local fullPath = vim.fn.expand('%:p')
    if fullPath:sub(1, #vim.env.PROJECTS) == vim.env.PROJECTS then
        local localPath = fullPath:sub(#vim.env.PROJECTS + 1)
        local sepIdx = localPath:find(sep, 2)
        local project = localPath:sub(1, sepIdx)
        local gitlabUrl = project == 'dash' and analyticsGitlabUrl or rcGitlabUrl
        return gitlabUrl .. project .. commit .. localPath:sub(sepIdx)
    end
end

local function gitlabLine()
    local url = gitlabFile()
    return url and (url .. '#L' .. vim.api.nvim_win_get_cursor(0)[1])
end

return {
    "folke/which-key.nvim",
    lazy = false,
    config = function()
        require("which-key").setup({
            plugins = {
                marks = true,
                registers = false,
                spelling = {
                    enabled = true,
                    suggestions = 10,
                },
            },
        })
        local wk = require("which-key")
        -- wk.register({
        -- 	["'"] = { "`", "Use ' to go to a marked position" },
        -- 	["`"] = { "'", "Use ` to go to a marked line" },
        -- }, { mode = "" })

        wk.add({
            {
                "qq",
                ":bp<bar>bd#<CR>",
                desc = "Close the current buffer"
            },
            {
                "qt",
                ":tabclose<CR>",
                desc = "Close the current tab"
            },
            {
                "qw",
                ":close<CR>",
                desc = "Close the current window"
            },
            {
                "qQ",
                ":bd<CR>",
                desc = "Close the current buffer and window"
            },
            {
                "QQ",
                ":bd!<CR>",
                desc = "Force close the current buffer and window"
            },
            {
                "qh",
                ":helpclose<cr>",
                desc = "Close the help window"
            },
            {
                "gb",
                "<C-^>",
                desc = "Go back"
            },

            -- Communicate with quickfix
            {
                "qo",
                ":copen<CR>",
                desc = "Open quickfix window"
            },
            {
                "qc",
                ":cclose<CR>",
                desc = "Close quickfix window"
            },
            {
                "[q",
                ":cprevious<CR>",
                desc = "Go to previous quickfix item"
            },
            {
                "]q",
                ":cnext<CR>",
                desc = "Go to next quickfix item"
            },

            -- hotkeys to swap between buffers
            {
                "[b",
                ":bprevious<CR>",
                desc = "Go to previous buffer"
            },
            {
                "]b",
                ":bnext<CR>",
                desc = "Go to next buffer"
            },
            -- hotkeys to swap between tabs
            {
                "[t",
                ":tabprevious<CR> ",
                desc = "Go to  previous tab "
            },
            {
                "]t",
                ":tabnext<CR>",
                desc = "Go to next tab "
            },
            {
                "j",
                "gj",
                desc = "Move cursor down naturally by display"
            },
            {
                "k",
                "gk",
                desc = "move cursor up naturally by display"
            },
            {
                "Y",
                "y$",
                desc = "Yank till the end of line"
            },
            {
                "<leader>cd",
                ":cd %:p:h<cr>:pwd<cr>",
                desc = "Change cwd to the directory with current file",
            },
            {
                '<space>cf',
                ":let @+=expand('%:t') | echo @+ .. ' was copied to the clipboard.'<cr>",
                desc = "Copy file name"
            },
            {
                '<space>cp',
                ":let @+=expand('%:p') | echo @+ .. ' was copied to the clipboard.'<cr>",
                desc = "Copy full file path"
            },
            {
                '<space>cl',
                ":let @+=fnamemodify(expand('%'), ':~:.') | echo @+ .. ' was copied to the clipboard.'<cr>",
                desc = "Copy local file path"
            },
            {
                '<space>glcf',
                function()
                    local url = gitlabFile()
                    vim.fn.setreg('+', url)
                    print(url, 'was copied to the clipboard')
                end,
                desc = "Copy gitlab url to the current file"
            },
            {
                '<space>glcl',
                function()
                    local url = gitlabLine()
                    vim.fn.setreg('+', url)
                    print(url, 'was copied to the clipboard')
                end,
                desc = "Copy gitlab url to the current line"
            },
            {
                '<space>glof',
                function()
                    local url = gitlabFile()
                    -- vim.fn.setreg('+', url)
                    -- print(url, 'was copied to the clipboard')
                    os.execute('open ' .. url)
                end,
                desc = "Open gitlab url to the current file"
            },
            {
                '<space>glol',
                function()
                    local url = gitlabLine()
                    -- vim.fn.setreg('+', url)
                    -- print(url, 'was copied to the clipboard')
                    os.execute('open ' .. url)
                end,
                desc = "Open gitlab url to the current line"
            },
            {
                '<space>yf',
                ":let @\"=expand('%:t') | echo @\" .. ' was copied to the register \".'<cr>",
                desc = "Yank file name"
            },
            {
                '<space>yp',
                ":let @\"=expand('%:p') | echo @\" .. ' was copied to the register \".'<cr>",
                desc = "Yank full file path"
            },
            {
                '<space>yl',
                ":let @\"=fnamemodify(expand('%'), ':~:.') | echo @\" .. ' was copied to the register \".'<cr>",
                desc = "Yank local file path"
            },
            {
                "<F1>",
                "K",
            },
            {
                "<F2>",
                ":set wrap!<bar>set linebreak!<CR>",
                desc = "Toggle the wrapping a text"
            },
            {
                "<F3>",
                ":set hlsearch!<CR>",
                desc = "Toggle search highlighting"
            },
            {
                "<F4>",
                ":Lazy<cr>",
                desc = "Run Lazy UI"
            },
            {
                "<F5>",
                ":so % <bar> echo 'script has been invoked' <CR>",
                desc = "Run current script"
            },
            -- Visual mode
            {
                "<C-c>",
                '"+y',
                desc = "copy to the clipboard",
                mode =
                "v"
            },
            -- indent block without loosing selection
            {
                "<",
                "<gv",
                mode =
                "x"
            },
            {
                ">",
                ">gv",
                mode =
                "x"
            },
        })
    end,
}
