package com.voltbill.pro.ui.nav

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.voltbill.pro.data.Customer
import com.voltbill.pro.data.Product
import com.voltbill.pro.data.ServiceJob
import com.voltbill.pro.ui.AppViewModel
import com.voltbill.pro.ui.customers.CustomerScreen
import com.voltbill.pro.ui.dashboard.DashboardScreen
import com.voltbill.pro.ui.invoices.CreateInvoiceScreen
import com.voltbill.pro.ui.invoices.InvoiceDetailScreen
import com.voltbill.pro.ui.invoices.InvoiceListScreen
import com.voltbill.pro.ui.products.ProductScreen
import com.voltbill.pro.ui.reports.ReportsScreen
import com.voltbill.pro.ui.service.ServiceScreen
import com.voltbill.pro.ui.settings.SettingsScreen
import com.voltbill.pro.ui.warranty.WarrantyScreen
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope

sealed class Dest(val route: String, val label: String, val icon: ImageVector) {
    data object Dashboard : Dest("dashboard", "Home", Icons.Default.Dashboard)
    data object Invoices : Dest("invoices", "Bills", Icons.AutoMirrored.Filled.ReceiptLong)
    data object Customers : Dest("customers", "Parties", Icons.Default.Groups)
    data object Products : Dest("products", "Stock", Icons.Default.Inventory2)
    data object Reports : Dest("reports", "Reports", Icons.Default.Insights)
    data object Warranty : Dest("warranty", "Warranty", Icons.Default.Shield)
    data object Service : Dest("service", "Service", Icons.Default.Build)
    data object Settings : Dest("settings", "Settings", Icons.Default.Settings)
}

private val BOTTOM = listOf(Dest.Dashboard, Dest.Invoices, Dest.Customers, Dest.Products, Dest.Reports)
private val OVERFLOW = listOf(Dest.Warranty, Dest.Service, Dest.Settings)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppNav(vm: AppViewModel) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    val scope = rememberCoroutineScope()

    var editingCustomer by remember { mutableStateOf<Customer?>(null) }
    var editingProduct by remember { mutableStateOf<Product?>(null) }
    var editingService by remember { mutableStateOf<ServiceJob?>(null) }
    var menuOpen by remember { mutableStateOf(false) }

    val fullScreen = route == "create_invoice" || route?.startsWith("invoice/") == true
    val current = (BOTTOM + OVERFLOW).firstOrNull { it.route == route }

    Scaffold(
        topBar = {
            if (!fullScreen && route != Dest.Dashboard.route) {
                TopAppBar(
                    title = { Text(current?.label ?: "VoltBill Pro") },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        titleContentColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            }
        },
        bottomBar = {
            if (!fullScreen) {
                NavigationBar {
                    BOTTOM.forEach { dest ->
                        NavigationBarItem(
                            selected = route == dest.route,
                            onClick = {
                                nav.navigate(dest.route) {
                                    popUpTo(Dest.Dashboard.route) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(dest.icon, dest.label) },
                            label = { Text(dest.label, style = MaterialTheme.typography.labelSmall) }
                        )
                    }
                    NavigationBarItem(
                        selected = OVERFLOW.any { it.route == route },
                        onClick = { menuOpen = true },
                        icon = {
                            Icon(Icons.Default.MoreHoriz, "More")
                            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                                OVERFLOW.forEach { dest ->
                                    DropdownMenuItem(
                                        text = { Text(dest.label) },
                                        leadingIcon = { Icon(dest.icon, null) },
                                        onClick = {
                                            menuOpen = false
                                            nav.navigate(dest.route) { launchSingleTop = true }
                                        }
                                    )
                                }
                            }
                        },
                        label = { Text("More", style = MaterialTheme.typography.labelSmall) }
                    )
                }
            }
        },
        floatingActionButton = {
            if (!fullScreen) {
                when (route) {
                    Dest.Dashboard.route, Dest.Invoices.route -> FloatingActionButton(
                        onClick = { nav.navigate("create_invoice") }
                    ) { Icon(Icons.Default.Add, "New invoice") }

                    Dest.Customers.route -> FloatingActionButton(
                        onClick = { editingCustomer = Customer(name = "") }
                    ) { Icon(Icons.Default.Add, "New customer") }

                    Dest.Products.route -> FloatingActionButton(
                        onClick = { editingProduct = Product(name = "") }
                    ) { Icon(Icons.Default.Add, "New product") }

                    Dest.Service.route -> FloatingActionButton(
                        onClick = {
                            scope.launch {
                                editingService = ServiceJob(
                                    jobNo = vm.nextJobNo(), customerId = 0, customerName = ""
                                )
                            }
                        }
                    ) { Icon(Icons.Default.Add, "New job") }
                }
            }
        }
    ) { pad ->
        NavHost(
            navController = nav,
            startDestination = Dest.Dashboard.route,
            modifier = Modifier.padding(pad)
        ) {
            composable(Dest.Dashboard.route) {
                DashboardScreen(
                    vm,
                    onOpenInvoice = { nav.navigate("invoice/$it") },
                    onNewInvoice = { nav.navigate("create_invoice") }
                )
            }
            composable(Dest.Invoices.route) {
                InvoiceListScreen(vm) { nav.navigate("invoice/$it") }
            }
            composable(Dest.Customers.route) {
                CustomerScreen(vm, editingCustomer) { editingCustomer = it }
            }
            composable(Dest.Products.route) {
                ProductScreen(vm, editingProduct) { editingProduct = it }
            }
            composable(Dest.Reports.route) { ReportsScreen(vm) }
            composable(Dest.Warranty.route) { WarrantyScreen(vm) }
            composable(Dest.Service.route) {
                ServiceScreen(vm, editingService) { editingService = it }
            }
            composable(Dest.Settings.route) { SettingsScreen(vm) }

            composable("create_invoice") {
                CreateInvoiceScreen(
                    vm,
                    onBack = { nav.popBackStack() },
                    onSaved = { id ->
                        nav.popBackStack()
                        nav.navigate("invoice/$id")
                    }
                )
            }
            composable(
                "invoice/{id}",
                arguments = listOf(navArgument("id") { type = NavType.LongType })
            ) { entry ->
                InvoiceDetailScreen(
                    vm,
                    invoiceId = entry.arguments?.getLong("id") ?: 0L,
                    onBack = { nav.popBackStack() }
                )
            }
        }
    }
}

