rvimrc                           | 93 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 .vimrc                               |  2 +-
 4 files changed, 100 insertions(+), 5 deletions(-)
 create mode 100644 .ideavimrc
~ ❱ v                                                                                                                                                                                             6:44 PM

~ ❱                                                                                                                                                                                               8:31 PM
    ~ ❱ n                                                                                                                                                                                             8:31 PM
    ~ ❱ dot pull                                                                              ~ �  ~ ❱ dot pull                                                                                     9:16 PM
    error: cannot pull with rebase: You have unstaged changes.
error: please commit or stash them.
~ ❱ vim zsh                                                                                                                                                                                       9:17 PM
    ~ ❱ vim .zshrc                                                                                                                                                                                    9:17 PM
    ~ ❱ n                                                                                                                                                                                             9:18 PM
    ~ ❱ source .zshrc                                                                                                                                                                                 9:20 PM
    .zshrc:150: command not found: kubectl
    ~ ❱                                               eturn {
    active = {
        left = {
            a = { '▊', 'file_status_icon', 'working_directory' },
            b = { 'relative_file_name' },
        },
        right = {
            u = { 'diagnostic_warnings', 'diagnostic_errors' },
            v = { 'git_icon', 'git_branch' },
            w = { 'lsp_client_icon', 'treesitter_parser_icon' },
            x = { 'spellcheck_icon' },
            y = { 'position' },
            z = { 'scroll_bar' },
        },
    },
    inactive = {
        left = {
            a = { 'relative_file_name' },
        },
    },
    theme = require('cosmosline.theme'),
    colors = require('cosmosline.colors'),
    components = vim.tbl_extend('error', require('feline-ex.components'), require('feline-ex.icons'), require('feline-ex.lsp.icons'))
}
