cmake_minimum_required(VERSION 3.21)
project(TriMindHEXplorerNative LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
# HEXplorer upstream c67a73f is a Qt6 port. Never compile this with Qt5.
find_package(Qt6 REQUIRED COMPONENTS Core Gui Widgets Xml Sql Concurrent Network)
if(NOT DEFINED HEXPLORER_DIR)
  message(FATAL_ERROR "Set -DHEXPLORER_DIR to upstream HEXplorer source checkout")
endif()
if(NOT EXISTS "${HEXPLORER_DIR}/src/ASAP2/Nodes/a2lfile.cpp")
  message(FATAL_ERROR "Native upstream HEXplorer sources missing")
endif()

file(GLOB SOURCE_NODES CONFIGURE_DEPENDS "${HEXPLORER_DIR}/src/ASAP2/Nodes/*.cpp")
file(GLOB SOURCE_ITEMS CONFIGURE_DEPENDS "${HEXPLORER_DIR}/src/ASAP2/Items/*.cpp")
add_executable(hexplorer_a2l_cli
  hexplorer_a2l_cli.cpp
  "${HEXPLORER_DIR}/src/ASAP2/node.cpp"
  "${HEXPLORER_DIR}/src/ASAP2/lexer.cpp"
  "${HEXPLORER_DIR}/src/ASAP2/a2lgrammar.cpp"
  ${SOURCE_NODES}
  ${SOURCE_ITEMS}
)
target_include_directories(hexplorer_a2l_cli PRIVATE
  "${HEXPLORER_DIR}/src"
  "${HEXPLORER_DIR}/src/ASAP2"
  "${HEXPLORER_DIR}/src/ASAP2/Items"
  "${HEXPLORER_DIR}/src/ASAP2/Nodes"
  "${HEXPLORER_DIR}/src/DataContainers"
  "${HEXPLORER_DIR}/src/DataModels"
  "${HEXPLORER_DIR}/src/WidgetsViews"
  "${HEXPLORER_DIR}/src/ui_forms"
)
target_link_libraries(hexplorer_a2l_cli PRIVATE
  Qt6::Core Qt6::Gui Qt6::Widgets Qt6::Xml Qt6::Sql Qt6::Concurrent Qt6::Network)
