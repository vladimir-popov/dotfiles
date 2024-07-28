return {
    "lewis6991/gitsigns.nvim",
    event = "VeryLazy",
    config = function()
        local gs = require("gitsigns")
        gs.setup({
            on_attach = function(bufnr)
                local wk = require("which-key")
                wk.add({
                    { "<leader>hs", gs.stage_hunk,   desc = "Stage the hunk",          buffer = bufnr },
                    { "<leader>hu", gs.reset_hunk,   desc = "Reset the hunk",          buffer = bufnr },
                    { "[h",         gs.prev_hunk,    desc = "Go to the previous hunk", buffer = bufnr },
                    { "]h",         gs.next_hunk,    desc = "Go to the next hunk",     buffer = bufnr },
                    { "<leader>hp", gs.preview_hunk, desc = "Preview the hunk",        buffer = bufnr },
                    {
                        "<leader>gb",
                        function()
                            gs.blame_line({ full = true })
                        end,
                        desc = "Show git blame",
                        buffer = bufnr
                    },
                    {
                        "<leader>hb",
                        gs.toggle_current_line_blame,
                        desc = "Show git blame for the current line",
                        buffer = bufnr
                    },
                    {
                        "<leader>hd",
                        gs.diffthis,
                        desc = "Show changes",
                        buffer = bufnr
                    },
                    {
                        "<leader>hs",
                        function()
                            gs.stage_hunk({ vim.fn.line("."), vim.fn.line("v") })
                        end,
                        desc = "Stage the hunk",
                        mode = "v",
                        buffer = bufnr
                    },
                    {
                        "<leader>hu",
                        function()
                            gs.reset_hunk({ vim.fn.line("."), vim.fn.line("v") })
                        end,
                        desc = "Reset the hunk",
                        mode = "v",
                        buffer = bufnr
                    },
                })
            end,
            signs = {
                add = { text = "+" },
                change = { text = "~" },
                delete = { text = "_" },
                untracked = { text = "?" },
            },
        })
    end,
}
