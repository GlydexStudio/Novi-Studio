cmake_minimum_required(VERSION 3.22.1)

project(novi_node_bridge LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

get_filename_component(APP_DIR "${CMAKE_CURRENT_LIST_DIR}/../../.." ABSOLUTE)

add_library(libnode SHARED IMPORTED GLOBAL)
set_target_properties(libnode PROPERTIES
    IMPORTED_LOCATION "${APP_DIR}/libnode/bin/${ANDROID_ABI}/libnode.so"
    INTERFACE_INCLUDE_DIRECTORIES "${APP_DIR}/libnode/include/node"
)

add_library(novi-node-bridge SHARED
    node_bridge.cpp
)

target_compile_options(novi-node-bridge PRIVATE
    -fexceptions
    -frtti
)

# libnode.so already carries Node/V8/UV and its Android shared-library
# dependencies. The bridge only links the exported node::Start API.
target_link_libraries(novi-node-bridge
    libnode
)
