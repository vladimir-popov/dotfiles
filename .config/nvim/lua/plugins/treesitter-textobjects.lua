return {
    'nvim-treesitter/nvim-treesitter-textobjects',
    event = "VeryLazy",
    branch = "main",
    config = function()
        require("nvim-treesitter-textobjects").setup({
            select = {
                lookahead = true,
            },
        })

        -- swap
        local swap = require("nvim-treesitter-textobjects.swap")
        vim.keymap.set("n", "<space>swa", function()
            swap.swap_next "@parameter.inner"
        end)
        vim.keymap.set("n", "<space>swA", function()
            swap.swap_previous "@parameter.outer"
        end)
        vim.keymap.set("n", "<space>swf", function()
            swap.swap_next "@function.inner"
        end)
        vim.keymap.set("n", "<space>swF", function()
            swap.swap_previous "@function.outer"
        end)
        vim.keymap.set("n", "<space>swc", function()
            swap.swap_next "@class.inner"
        end)
        vim.keymap.set("n", "<space>swC", function()
            swap.swap_previous "@class.outer"
        end)

        -- goto
        local move = require("nvim-treesitter-textobjects.move")
        vim.keymap.set({ "n", "x", "o" }, "]f", function()
            move.goto_next_start("@function.outer", "textobjects")
        end)
        vim.keymap.set({ "n", "x", "o" }, "[f", function()
            move.goto_previous_start("@function.outer", "textobjects")
        end)
        vim.keymap.set({ "n", "x", "o" }, "]c", function()
            move.goto_next_start("@class.outer", "textobjects")
        end)
        vim.keymap.set({ "n", "x", "o" }, "[c", function()
            move.goto_previous_start("@class.outer", "textobjects")
        end)
        vim.keymap.set({ "n", "x", "o" }, "]z", function()
            move.goto_next_start("@fold", "folds")
        end)

        -- select
        local select = require("nvim-treesitter-textobjects.select")
        vim.keymap.set({ "x", "o" }, "af", function()
            select.select_textobject("@function.outer", "textobjects")
        end)
        vim.keymap.set({ "x", "o" }, "if", function()
            select.select_textobject("@function.inner", "textobjects")
        end)
        vim.keymap.set({ "x", "o" }, "ac", function()
            select.select_textobject("@class.outer", "textobjects")
        end)
        vim.keymap.set({ "x", "o" }, "ic", function()
            select.select_textobject("@class.inner", "textobjects")
        end)
    end,
}
