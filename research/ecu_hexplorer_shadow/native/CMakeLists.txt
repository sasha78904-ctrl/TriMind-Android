cmake_minimum_required(VERSION 3.16)
project(TriMindHEXplorerNative LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
find_package(Qt5 REQUIRED COMPONENTS Core Gui Widgets)
if(NOT DEFINED HEXPLORER_DIR)
 message(FATAL_ERROR "Set -DHEXPLORER_DIR=path/to/HEXplorer")
endif()
file(GLOB SOURCE_NODES CONFIGURE_DEPENDS "${HEXPLORER_DIR}/src/ASAP2/Nodes/*.cpp")
file(GLOB SOURCE_ITEMS CONFIGURE_DEPENDS "${HEXPLORER_DIR}/src/ASAP2/Items/*.cpp")
add_executable(hexplorer_a2l_cli
 hexplorer_a2l_cli.cpp
 "${HEXPLORER_DIR}/src/ASAP2/node.cpp"
 "${HEXPLORER_DIR}/src/ASAP2/item.cpp"
 "${HEXPLORER_DIR}/src/ASAP2/lexer.cpp"
 "${HEXPLORER_DIR}/src/ASAP2/a2lgrammar.cpp"
 ${SOURCE_NODES} ${SOURCE_ITEMS})
target_include_directories(hexplorer_a2l_cli PRIVATE
 "${HEXPLORER_DIR}/src"
 "${HEXPLORER_DIR}/src/ASAP2"
 "${HEXPLORER_DIR}/src/ASAP2/Items"
 "${HEXPLORER_DIR}/src/ASAP2/Nodes"
 "${HEXPLORER_DIR}/src/DataContainers"
 "${HEXPLORER_DIR}/src/DataModels"
 "${HEXPLORER_DIR}/src/WidgetsViews"
 "${HEXPLORER_DIR}/src/ui_forms")
target_link_libraries(hexplorer_a2l_cli PRIVATE Qt5::Core Qt5::Gui Qt5::Widgets)
