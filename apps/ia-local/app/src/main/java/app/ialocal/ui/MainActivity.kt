package app.ialocal.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            IALocalTheme {
                when (vm.screen) {
                    Screen.Chat -> ChatScreen(vm)
                    Screen.Models -> {
                        BackHandler(enabled = vm.activeModel != null) { vm.screen = Screen.Chat }
                        ModelsScreen(vm)
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        vm.refreshInstalled()
    }
}
