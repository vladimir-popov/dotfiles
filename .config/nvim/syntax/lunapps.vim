if exists("b:lunapps")
    finish
endif

syntax keyword Constant true false
syntax keyword lunaPpsKeyword empty emptyMessage emptyArray
syntax region lunaPpsString start=+"+ end=+"+
syntax match lunaPpsType "\v^\s+\w+\:(\w+\:)?"
syntax region lunaPpsField start="\v\s+\d+\:"hs=e+1 end="="he=e-1
syntax match lunaPpsValue "\v\w+\:"he=e-1


hi link lunaPpsKeyword Tag
hi link lunaPpsString String
hi link lunaPpsType Comment
hi link lunaPpsField Keyword
hi link lunaPpsValue Identifier

let b:lunapps = "lunapps"
