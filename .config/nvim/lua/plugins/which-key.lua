local sep = package.config:sub(1, 1)

local function gitlabFile()
    local commit = '-/tree/master'
    local rcGitlabUrl = 'https://git.ringcentral.com/dash'
    local fullPath = vim.fn.expand('%:p')
    if fullPath:sub(1, #vim.env.PROJECTS) == vim.env.PROJECTS then
        local localPath = fullPath:sub(#vim.env.PROJECTS + 1)
        local sepIdx = localPath:find(sep, 2)
        local project = localPath:sub(1, sepIdx)
        print('Current project is', project)
        return rcGitlabUrl .. project .. commit .. localPath:sub(sepIdx)
    end
end

local function gitlabLine()
    local url = gitlabFile()
    return url and (url .. '#L' .. vim.api.nvim_win_get_cursor(0)[1])
end

local function showLazyGit()
    if lazygit_tab and vim.api.nvim_tabpage_is_valid(lazygit_tab) then
        vim.api.nvim_set_current_tabpage(lazygit_tab)
        vim.cmd("startinsert")
        return
    end

    vim.cmd("tabnew")
    lazygit_tab = vim.api.nvim_get_current_tabpage()
    local tab = lazygit_tab

    vim.fn.jobstart("lazygit", {
        term = true,
        on_exit = function()
            vim.schedule(function()
                if vim.api.nvim_tabpage_is_valid(tab) then
                    vim.api.nvim_set_current_tabpage(tab)
                    if #vim.api.nvim_list_tabpages() > 1 then
                        vim.cmd("tabclose!")
                    else
                        vim.cmd("qa!")
                    end
                end

                if lazygit_tab == tab then
                    lazygit_tab = nil
                end
            end)
        end,
    })
    vim.cmd("startinsert")
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
            delay = 500,
        })
        local wk = require("which-key")
        -- fast switch between tabs
        local mappings = {}
        for i = 1, 9 do
            local tab = i -- сохранить номер для callback

            mappings[#mappings + 1] = {
                "<leader>" .. tab,
                function()
                    vim.cmd("tabnext " .. tab)
                end,
                mode = { "n", "t" },
                desc = "Перейти во вкладку " .. tab,
            }
        end
        wk.add(mappings)
        wk.add({
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
                -- "<leader>lg",
                "<F4>",
                showLazyGit,
                desc = "Open LazyGit in a new tab",
            },
            {
                "<F5>",
                ":Lazy<cr>",
                desc = "Run Lazy UI"
            },
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
                '<space>cuf',
                function()
                    local url = gitlabFile()
                    vim.fn.setreg('+', url)
                    print(url, 'was copied to the clipboard')
                end,
                desc = "Copy gitlab url to the current file"
            },
            {
                '<space>cul',
                function()
                    local url = gitlabLine()
                    vim.fn.setreg('+', url)
                    print(url, 'was copied to the clipboard')
                end,
                desc = "Copy gitlab url to the current line"
            },
            {
                '<space>ouf',
                function()
                    local url = gitlabFile()
                    -- vim.fn.setreg('+', url)
                    -- print(url, 'was copied to the clipboard')
                    os.execute('open ' .. url)
                end,
                desc = "Open gitlab url to the current file"
            },
            {
                '<space>oul',
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
            -- Visual mode
            {
                "<C-y>",
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
